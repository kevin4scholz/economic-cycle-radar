from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class Observation(BaseModel):
    model_config = ConfigDict(frozen=True)

    series_id: str
    observation_date: date
    value: float | None
    realtime_start: date | None = None
    realtime_end: date | None = None


class SeriesData(BaseModel):
    model_config = ConfigDict(frozen=True)

    series_id: str
    title: str
    units: str
    frequency: str
    source_url: str
    fetched_at_utc: datetime
    observations: list[Observation]


SignalState = Literal[
    "insufficient_data",
    "normal",
    "flattening",
    "inverted",
    "re_steepening",
    "data_stale",
    "fetch_failed",
]


class SignalPoint(BaseModel):
    model_config = ConfigDict(frozen=True)

    date: date
    value: float
    moving_average_5d: float | None
    state: SignalState
    score: int | None


class LatestObservation(BaseModel):
    series_id: str
    date: date
    value: float
    unit: str
    source_url: str


class Driver(BaseModel):
    title_fa: str
    value: str
    detail_fa: str


class SourceInfo(BaseModel):
    series_id: str
    title: str
    url: str
    fetched_at_utc: datetime


class RecessionPeriod(BaseModel):
    start: date
    end: date


class BacktestReport(BaseModel):
    inversion_events: int
    re_steepening_events: int
    recession_starts: int
    matched_signals: int
    false_alarms: int
    precision: float | None
    recall: float | None
    false_alarm_rate: float | None
    median_lead_months: float | None
    note_fa: str


class DashboardPayload(BaseModel):
    schema_version: Literal["1.0.0"] = "1.0.0"
    model_version: Literal["mvp-rule-v1"] = "mvp-rule-v1"
    data_mode: Literal["live", "fixture"]
    generated_at_utc: datetime
    horizon_months: Literal[12] = 12
    score: int | None
    phase: str
    state: SignalState
    score_change_7d: int | None
    confidence: Literal["high", "medium", "unavailable"]
    explanation_fa: str
    latest_observation: LatestObservation | None
    drivers: list[Driver] = Field(max_length=3)
    spread_history: list[SignalPoint]
    recession_periods: list[RecessionPeriod]
    backtest: BacktestReport
    sources: list[SourceInfo]

