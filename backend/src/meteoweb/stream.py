"""Proxy to go2rtc so the browser only ever talks to this app.

go2rtc's own API can edit its config and reach any source, so it is never published;
here the stream name is fixed server-side and only the player endpoints are exposed.
"""

import asyncio
import contextlib
from datetime import datetime

import httpx
import websockets
from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
from websockets.exceptions import ConnectionClosed

from meteoweb.frames import FrameKeeper

router = APIRouter(prefix="/stream", tags=["stream"])


def _ws_url(base: str, stream: str) -> str:
    return base.replace("http", "ws", 1) + f"/api/ws?src={stream}"


@router.websocket("/ws")
async def stream_ws(client: WebSocket) -> None:
    """Signalling (WebRTC) and MSE/HLS media, relayed both ways to go2rtc."""
    settings = client.app.state.settings
    await client.accept()
    try:
        upstream = await websockets.connect(
            _ws_url(settings.go2rtc_url, settings.stream_name), max_size=None
        )
    except OSError, websockets.InvalidHandshake:
        await client.close(code=1011, reason="go2rtc unavailable")
        return

    async def client_to_upstream() -> None:
        while True:
            message = await client.receive()
            if message["type"] == "websocket.disconnect":
                return
            text = message.get("text")
            await upstream.send(text if text is not None else message["bytes"])

    async def upstream_to_client() -> None:
        async for message in upstream:
            if isinstance(message, bytes):
                await client.send_bytes(message)
            else:
                await client.send_text(message)

    async with upstream:
        tasks = [
            asyncio.create_task(client_to_upstream()),
            asyncio.create_task(upstream_to_client()),
        ]
        # Whichever side hangs up first ends the session for both.
        with contextlib.suppress(WebSocketDisconnect, ConnectionClosed):
            done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
            for task in pending:
                task.cancel()
            for task in done:
                task.result()
    # The browser may already be gone; closing twice is not an error worth logging.
    with contextlib.suppress(RuntimeError, WebSocketDisconnect):
        await client.close()


async def _relay_get(request: Request, path: str, params: dict[str, str]) -> Response:
    settings = request.app.state.settings
    http: httpx.AsyncClient = request.app.state.go2rtc_http
    try:
        upstream = await http.get(f"{settings.go2rtc_url}{path}", params=params)
    except httpx.HTTPError:
        return Response(status_code=502)
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        media_type=upstream.headers.get("content-type"),
        headers={"Cache-Control": "no-store"},
    )


class LastFrameOut(BaseModel):
    captured_at: datetime


def _keeper(request: Request) -> FrameKeeper:
    return request.app.state.frames


@router.get("/last", summary="When the stored camera frame was taken")
async def last_frame(request: Request) -> LastFrameOut:
    """Shown with the frame when the camera is offline. 404 until a first frame is stored."""
    keeper = _keeper(request)
    if keeper.captured_at is None:
        raise HTTPException(status_code=404, detail="No frame stored yet")
    return LastFrameOut(captured_at=keeper.captured_at)


@router.get("/last.jpg", summary="Last stored camera frame", response_class=FileResponse)
async def last_frame_jpeg(request: Request) -> FileResponse:
    keeper = _keeper(request)
    if not keeper.path.is_file():
        raise HTTPException(status_code=404, detail="No frame stored yet")
    return FileResponse(keeper.path, media_type="image/jpeg", headers={"Cache-Control": "no-cache"})


@router.get("/hls/{segment}", include_in_schema=False)
async def hls(request: Request, segment: str) -> Response:
    # Safari without MSE plays HLS; the playlist go2rtc sends over the WebSocket points here.
    return await _relay_get(request, f"/api/hls/{segment}", dict(request.query_params))
