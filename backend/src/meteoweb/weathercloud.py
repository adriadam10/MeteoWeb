"""Client for the (unofficial) JSON endpoints behind the Weathercloud device page.

Weathercloud has no public API for personal stations, so this mirrors what its own
web page does: `values` and `stats` are plain GETs that only answer to XHR requests,
and `evolution` (history) is a POST that needs the session cookie plus the CSRF token
embedded in the device page. See docs/weathercloud.md.
"""

import asyncio
import re
from datetime import UTC, datetime
from typing import Any

import httpx

from meteoweb.cache import TTLCache
from meteoweb.schemas import (
    CurrentOut,
    DayRange,
    HistoryOut,
    HistoryPoint,
    HistoryVariable,
    Metric,
    Period,
    Reading,
)

BASE_URL = "https://app.weathercloud.net"
XHR_HEADERS = {"X-Requested-With": "XMLHttpRequest"}
CSRF_RE = re.compile(r'WEATHERCLOUD_CSRF_TOKEN:"([^"]+)"')

# Field prefix used by `values` and `stats` for each metric.
METRIC_FIELDS: dict[Metric, str] = {
    Metric.temperature: "temp",
    Metric.humidity: "hum",
    Metric.dew_point: "dew",
    Metric.heat_index: "heat",
    Metric.pressure: "bar",
    Metric.wind_speed: "wspd",
    Metric.wind_speed_avg: "wspdavg",
    Metric.wind_direction: "wdir",
    Metric.rain: "rain",
    Metric.rain_rate: "rainrate",
    Metric.uv_index: "uvi",
    Metric.solar_radiation: "solarrad",
}

# Numeric sensor ids the evolution endpoint expects (taken from the device page charts).
HISTORY_SENSORS: dict[HistoryVariable, str] = {
    HistoryVariable.temperature: "101",
    HistoryVariable.humidity: "201",
    HistoryVariable.pressure: "701",
    HistoryVariable.wind_speed: "541",
    HistoryVariable.rain: "801",
    HistoryVariable.solar_radiation: "1001",
    HistoryVariable.uv_index: "1101",
}


class WeathercloudError(Exception):
    pass


def _ts(epoch: float | None) -> datetime | None:
    return datetime.fromtimestamp(epoch, UTC) if epoch is not None else None


def _reading(pair: list[float] | None) -> Reading | None:
    if not pair or pair[1] is None:
        return None
    return Reading(at=_ts(pair[0]), value=pair[1])


def parse_current(values: dict[str, Any], stats: dict[str, Any], device: str) -> CurrentOut:
    if "epoch" not in values:
        raise WeathercloudError("Weathercloud returned no current values")
    today = {
        metric: DayRange(
            min=_reading(stats.get(f"{field}_day_min")),
            max=_reading(stats.get(f"{field}_day_max")),
        )
        for metric, field in METRIC_FIELDS.items()
        if f"{field}_day_max" in stats
    }
    return CurrentOut(
        observed_at=_ts(values["epoch"]),
        values={metric: values.get(field) for metric, field in METRIC_FIELDS.items()},
        today=today,
        station_url=f"{BASE_URL}/d{device}",
    )


def parse_history(data: dict[str, Any], variable: HistoryVariable, period: Period) -> HistoryOut:
    sensor = HISTORY_SENSORS[variable]
    points = []
    for epoch, sensors in sorted(data["values"].items(), key=lambda item: int(item[0])):
        bucket = sensors.get(sensor) or {}
        samples = bucket.get("samples") or 0
        stats = bucket.get("stats") or {}
        if samples == 0:
            continue
        points.append(
            HistoryPoint(
                at=_ts(int(epoch)),
                avg=round(stats["sum"] / samples, 2) if stats.get("sum") is not None else None,
                min=stats.get("min"),
                max=stats.get("max"),
                total=stats.get("total"),
            )
        )
    return HistoryOut(variable=variable, period=period, points=points)


class WeathercloudClient:
    def __init__(self, device: str, http: httpx.AsyncClient) -> None:
        self.device = device
        self._http = http
        self._csrf_token: str | None = None
        # Stations upload every few minutes; caching keeps us polite with many viewers.
        self._current_cache: TTLCache[CurrentOut] = TTLCache(60)
        self._history_cache: TTLCache[HistoryOut] = TTLCache(600)

    async def current(self) -> CurrentOut:
        return await self._current_cache.get("current", self._fetch_current)

    async def history(self, variable: HistoryVariable, period: Period) -> HistoryOut:
        return await self._history_cache.get(
            f"{variable}:{period}", lambda: self._fetch_history(variable, period)
        )

    async def _get_json(self, path: str) -> dict[str, Any]:
        response = await self._http.get(
            f"{BASE_URL}{path}", params={"code": self.device}, headers=XHR_HEADERS
        )
        response.raise_for_status()
        if not response.content:
            raise WeathercloudError(f"Empty response from Weathercloud {path}")
        return response.json()

    async def _fetch_current(self) -> CurrentOut:
        try:
            values, stats = await asyncio.gather(
                self._get_json("/device/values"), self._get_json("/device/stats")
            )
        except httpx.HTTPError as exc:
            raise WeathercloudError(f"Weathercloud unreachable ({type(exc).__name__})") from exc
        return parse_current(values, stats, self.device)

    async def _refresh_csrf_token(self) -> str:
        response = await self._http.get(f"{BASE_URL}/d{self.device}")
        response.raise_for_status()
        match = CSRF_RE.search(response.text)
        if not match:
            raise WeathercloudError("CSRF token not found in the Weathercloud device page")
        self._csrf_token = match.group(1)
        return self._csrf_token

    async def _post_evolution(self, sensor: str, period: Period) -> dict[str, Any] | None:
        token = self._csrf_token or await self._refresh_csrf_token()
        response = await self._http.post(
            f"{BASE_URL}/device/evolution",
            headers=XHR_HEADERS,
            data={
                "device": self.device,
                "variable": sensor,
                "period": period.value,
                "WEATHERCLOUD_CSRF_TOKEN": token,
            },
        )
        if response.status_code >= 400 or not response.content:
            return None
        body = response.json()
        return body.get("data") if body.get("status") == "success" else None

    async def _fetch_history(self, variable: HistoryVariable, period: Period) -> HistoryOut:
        sensor = HISTORY_SENSORS[variable]
        try:
            data = await self._post_evolution(sensor, period)
            if data is None:
                # The session or token expired: start a fresh one and retry once.
                self._csrf_token = None
                self._http.cookies.clear()
                data = await self._post_evolution(sensor, period)
        except httpx.HTTPError as exc:
            raise WeathercloudError(f"Weathercloud unreachable ({type(exc).__name__})") from exc
        if data is None:
            raise WeathercloudError("Weathercloud rejected the history request")
        return parse_history(data, variable, period)
