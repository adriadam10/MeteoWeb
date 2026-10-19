"""Keeps the last good camera frame on disk, so the page has something to show when the
camera is down (and after a restart). Grabs a JPEG from go2rtc every `interval` seconds.
"""

import asyncio
import contextlib
import logging
from datetime import UTC, datetime
from pathlib import Path

import httpx

log = logging.getLogger(__name__)

JPEG_MAGIC = b"\xff\xd8"


class FrameKeeper:
    def __init__(
        self, http: httpx.AsyncClient, frame_url: str, path: Path, interval: float
    ) -> None:
        self._http = http
        self._frame_url = frame_url
        self._path = path
        self._interval = interval
        self.captured_at: datetime | None = None
        if path.is_file():
            self.captured_at = datetime.fromtimestamp(path.stat().st_mtime, UTC)

    @property
    def path(self) -> Path:
        return self._path

    async def grab(self) -> bool:
        """One attempt; returns whether a new frame was stored."""
        try:
            response = await self._http.get(self._frame_url)
        except httpx.HTTPError as exc:
            log.warning("frame grab failed: %s", type(exc).__name__)
            return False
        # go2rtc answers 200 with an empty body when the camera is unreachable.
        if not response.is_success or not response.content.startswith(JPEG_MAGIC):
            return False
        tmp = self._path.with_suffix(".tmp")
        tmp.write_bytes(response.content)
        tmp.replace(self._path)  # atomic: readers never see a half-written file
        self.captured_at = datetime.now(UTC)
        return True

    async def run(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        while True:
            await self.grab()
            await asyncio.sleep(self._interval)


@contextlib.asynccontextmanager
async def running(keeper: FrameKeeper):
    task = asyncio.create_task(keeper.run())
    try:
        yield keeper
    finally:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task
