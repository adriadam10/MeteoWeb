"""Runtime settings, read once from the environment at startup."""

import os
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_STATIC_DIR = REPO_ROOT / "frontend" / "dist"
DEFAULT_DATA_DIR = REPO_ROOT / "data"


@dataclass(frozen=True)
class Settings:
    weathercloud_device: str
    go2rtc_url: str
    stream_name: str
    static_dir: Path
    data_dir: Path
    frame_interval: float
    debug: bool


def load_settings() -> Settings:
    device = os.environ.get("WEATHERCLOUD_DEVICE", "").strip()
    if not device.isdigit():
        raise RuntimeError("WEATHERCLOUD_DEVICE must be the numeric Weathercloud device code")
    return Settings(
        weathercloud_device=device,
        go2rtc_url=os.environ.get("GO2RTC_URL", "http://go2rtc:1984").rstrip("/"),
        stream_name=os.environ.get("STREAM_NAME", "cam"),
        static_dir=Path(os.environ.get("STATIC_DIR", DEFAULT_STATIC_DIR)),
        data_dir=Path(os.environ.get("DATA_DIR", DEFAULT_DATA_DIR)),
        frame_interval=float(os.environ.get("FRAME_INTERVAL", "60")),
        debug=os.environ.get("DEBUG", "").lower() == "true",
    )
