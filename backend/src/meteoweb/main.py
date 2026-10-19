"""MeteoWeb: live camera (via go2rtc) next to the readings of a Weathercloud station.

Run: `uvicorn --factory meteoweb.main:app --host 0.0.0.0 --port 3000` (see README for the env vars).
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from meteoweb import api, frames, stream
from meteoweb.config import Settings, load_settings
from meteoweb.frames import FrameKeeper
from meteoweb.weathercloud import WeathercloudClient, WeathercloudError

API_PREFIX = "/api/v1"
USER_AGENT = "Mozilla/5.0 (compatible; MeteoWeb/2; +https://github.com/adriadam10/meteoweb)"


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or load_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        async with (
            httpx.AsyncClient(
                headers={"User-Agent": USER_AGENT},
                # Weathercloud now and then ignores a connect; fail fast and retry instead.
                timeout=httpx.Timeout(10, connect=4),
                transport=httpx.AsyncHTTPTransport(retries=2),
            ) as weather_http,
            httpx.AsyncClient(timeout=10) as go2rtc_http,
        ):
            app.state.weathercloud = WeathercloudClient(settings.weathercloud_device, weather_http)
            app.state.go2rtc_http = go2rtc_http
            keeper = FrameKeeper(
                go2rtc_http,
                f"{settings.go2rtc_url}/api/frame.jpeg?src={settings.stream_name}",
                settings.data_dir / "last.jpg",
                settings.frame_interval,
            )
            async with frames.running(keeper):
                app.state.frames = keeper
                yield

    # No auth here (everything is read-only and public), so Swagger only shows up in debug.
    app = FastAPI(
        title="MeteoWeb",
        description="Live camera and Weathercloud station readings. Read-only, no auth.",
        version="2.0.0",
        lifespan=lifespan,
        docs_url=f"{API_PREFIX}/docs" if settings.debug else None,
        redoc_url=None,
        openapi_url=f"{API_PREFIX}/openapi.json" if settings.debug else None,
    )
    app.state.settings = settings

    @app.exception_handler(WeathercloudError)
    async def weathercloud_error(_: Request, exc: WeathercloudError) -> JSONResponse:
        return JSONResponse(status_code=502, content={"detail": str(exc)})

    app.include_router(api.router, prefix=API_PREFIX)
    app.include_router(stream.router, prefix=API_PREFIX)
    if settings.static_dir.is_dir():
        app.mount("/", StaticFiles(directory=settings.static_dir, html=True), name="frontend")
    return app


def app() -> FastAPI:
    """Factory for `uvicorn --factory`, so settings are read at startup, not at import."""
    return create_app()
