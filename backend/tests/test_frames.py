from pathlib import Path

import httpx

from meteoweb.frames import FrameKeeper

JPEG = b"\xff\xd8\xff\xe0fake-jpeg"


def keeper_with(responses: list[httpx.Response], path: Path) -> FrameKeeper:
    replies = iter(responses)
    transport = httpx.MockTransport(lambda _: next(replies))
    return FrameKeeper(httpx.AsyncClient(transport=transport), "http://go2rtc/f", path, 60)


async def test_grab_keeps_last_good_frame_when_camera_drops(tmp_path: Path) -> None:
    path = tmp_path / "last.jpg"
    # go2rtc's way of saying "camera down" is an empty 200.
    keeper = keeper_with([httpx.Response(200, content=JPEG), httpx.Response(200)], path)

    assert await keeper.grab()
    first = keeper.captured_at
    assert not await keeper.grab()

    assert path.read_bytes() == JPEG
    assert keeper.captured_at == first


async def test_restart_restores_capture_time_from_disk(tmp_path: Path) -> None:
    path = tmp_path / "last.jpg"
    path.write_bytes(JPEG)

    assert keeper_with([], path).captured_at is not None
