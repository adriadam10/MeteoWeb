from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel


class Metric(StrEnum):
    temperature = "temperature"
    humidity = "humidity"
    dew_point = "dew_point"
    heat_index = "heat_index"
    pressure = "pressure"
    wind_speed = "wind_speed"
    wind_speed_avg = "wind_speed_avg"
    wind_direction = "wind_direction"
    rain = "rain"
    rain_rate = "rain_rate"
    uv_index = "uv_index"
    solar_radiation = "solar_radiation"


class HistoryVariable(StrEnum):
    temperature = "temperature"
    humidity = "humidity"
    pressure = "pressure"
    wind_speed = "wind_speed"
    rain = "rain"
    solar_radiation = "solar_radiation"
    uv_index = "uv_index"


class Period(StrEnum):
    day = "day"
    week = "week"
    month = "month"


class Reading(BaseModel):
    value: float
    at: datetime


class DayRange(BaseModel):
    min: Reading | None
    max: Reading | None


class CurrentOut(BaseModel):
    observed_at: datetime
    values: dict[Metric, float | None]
    today: dict[Metric, DayRange]
    station_url: str


class HistoryPoint(BaseModel):
    at: datetime
    avg: float | None
    min: float | None
    max: float | None
    total: float | None


class HistoryOut(BaseModel):
    variable: HistoryVariable
    period: Period
    points: list[HistoryPoint]


class HealthOut(BaseModel):
    status: str
