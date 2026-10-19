import json
from pathlib import Path

import httpx
import pytest

from meteoweb.schemas import HistoryVariable, Metric, Period
from meteoweb.weathercloud import (
    WeathercloudClient,
    WeathercloudError,
    parse_current,
    parse_history,
)

FIXTURES = Path(__file__).parent / "fixtures"
DEVICE = "1234567890"


def fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text())


def test_parse_current_maps_values_and_today_range() -> None:
    values, stats = fixture("values.json"), fixture("stats.json")

    current = parse_current(values, stats, DEVICE)

    assert current.values[Metric.temperature] == values["temp"]
    assert current.values[Metric.rain_rate] == values["rainrate"]
    temp_range = current.today[Metric.temperature]
    assert temp_range.max.value == stats["temp_day_max"][1]
    assert temp_range.min.value == stats["temp_day_min"][1]
    assert current.station_url.endswith(f"/d{DEVICE}")


def test_parse_current_rejects_empty_payload() -> None:
    with pytest.raises(WeathercloudError):
        parse_current({}, {}, DEVICE)


def test_parse_history_skips_empty_buckets_and_sorts() -> None:
    data = fixture("evolution_rain_day.json")["data"]

    history = parse_history(data, HistoryVariable.rain, Period.day)

    assert history.points, "fixture should contain rain buckets"
    times = [point.at for point in history.points]
    assert times == sorted(times)
    assert all(point.total is not None for point in history.points)


def page(token: str) -> str:
    return f'<script>data:{{WEATHERCLOUD_CSRF_TOKEN:"{token}"}}</script>'


async def test_history_retries_once_with_fresh_token() -> None:
    evolution = fixture("evolution_rain_day.json")
    tokens = iter(["stale", "fresh"])
    posted: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == f"/d{DEVICE}":
            return httpx.Response(200, text=page(next(tokens)))
        posted.append(request.content.decode())
        if "WEATHERCLOUD_CSRF_TOKEN=stale" in posted[-1]:
            return httpx.Response(403, text="")
        return httpx.Response(200, json=evolution)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        client = WeathercloudClient(DEVICE, http)
        history = await client.history(HistoryVariable.rain, Period.day)

    assert len(posted) == 2
    assert history.points
