from typing import Literal

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel

from meteoweb.schemas import CurrentOut, HealthOut, HistoryOut, HistoryVariable, Period
from meteoweb.weathercloud import WeathercloudClient

SUPPORTED_LOCALES = ("en", "es")
LOCALE_COOKIE = "locale"
LOCALE_COOKIE_MAX_AGE = 365 * 24 * 3600

router = APIRouter()


def _weathercloud(request: Request) -> WeathercloudClient:
    return request.app.state.weathercloud


@router.get("/healthz", tags=["meta"], summary="Liveness probe")
async def healthz() -> HealthOut:
    return HealthOut(status="ok")


@router.get("/weather/current", tags=["weather"], summary="Latest readings and today's range")
async def weather_current(request: Request) -> CurrentOut:
    return await _weathercloud(request).current()


@router.get(
    "/weather/history/{variable}", tags=["weather"], summary="Aggregated series for one variable"
)
async def weather_history(
    request: Request, variable: HistoryVariable, period: Period = Period.day
) -> HistoryOut:
    """Buckets are hourly for `day`, 6-hourly for `week` and daily for `month`."""
    return await _weathercloud(request).history(variable, period)


class LocaleIn(BaseModel):
    locale: Literal["en", "es"]


class LocaleOut(BaseModel):
    locale: str


def resolve_locale(cookie: str | None, accept_language: str) -> str:
    if cookie in SUPPORTED_LOCALES:
        return cookie
    ranked = []
    for part in accept_language.split(","):
        tag, _, q = part.strip().partition(";q=")
        try:
            weight = float(q) if q else 1.0
        except ValueError:
            continue
        ranked.append((weight, tag.split("-")[0].lower()))
    for _, lang in sorted(ranked, reverse=True):
        if lang in SUPPORTED_LOCALES:
            return lang
    return "en"


@router.get("/locale", tags=["meta"], summary="Interface language for this browser")
async def get_locale(request: Request) -> LocaleOut:
    """Cookie first, then `Accept-Language`, then English."""
    return LocaleOut(
        locale=resolve_locale(
            request.cookies.get(LOCALE_COOKIE), request.headers.get("accept-language", "")
        )
    )


@router.put("/locale", tags=["meta"], summary="Change the interface language")
async def put_locale(payload: LocaleIn, response: Response) -> LocaleOut:
    response.set_cookie(
        LOCALE_COOKIE, payload.locale, max_age=LOCALE_COOKIE_MAX_AGE, samesite="lax"
    )
    return LocaleOut(locale=payload.locale)
