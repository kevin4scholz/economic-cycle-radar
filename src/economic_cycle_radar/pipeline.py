from __future__ import annotations

import json
import os
from datetime import UTC, date, datetime
from pathlib import Path

from .backtest import build_backtest_report, recession_periods
from .fred import FredClient, load_fixture_series
from .models import DashboardPayload, Driver, LatestObservation, SourceInfo
from .scoring import compute_signal_history, freshness, phase_for_score, score_change_7d

STATE_LABELS = {
    "insufficient_data": "there is not enough valid data",
    "normal": "the yield curve is normal",
    "flattening": "the yield curve is flattening",
    "inverted": "the yield curve is inverted",
    "re_steepening": "the curve has re-steepened after inversion",
    "data_stale": "the latest data is stale",
    "fetch_failed": "the data fetch failed",
}


def _drivers(state: str, average: float | None, confidence: str) -> list[Driver]:
    average_text = "Unavailable" if average is None else f"{average:.2f}%"
    state_details = {
        "normal": "The 10-year minus 2-year spread is at or above the 0.50 threshold.",
        "flattening": "The spread is positive but below 0.50 and should be monitored.",
        "inverted": (
            "The five-observation average is below zero; this is not an immediate "
            "recession call."
        ),
        "re_steepening": "The curve turned non-negative again after a sustained inversion.",
        "data_stale": "The current score is withheld because the latest observation is stale.",
        "insufficient_data": "Fewer than five valid observations are available.",
    }
    return [
        Driver(
            title_en="Five-observation average",
            value=average_text,
            detail_en="Daily volatility is smoothed with the five most recent valid observations.",
        ),
        Driver(
            title_en="Yield-curve regime",
            value=STATE_LABELS.get(state, state),
            detail_en=state_details.get(state, "The current state is derived from the MVP rules."),
        ),
        Driver(
            title_en="Quality and freshness",
            value={"high": "High", "medium": "Medium", "unavailable": "Unavailable"}[confidence],
            detail_en="Freshness describes data quality, not forecasting certainty.",
        ),
    ]


def build_payload(
    spread_series,
    recession_series,
    *,
    as_of_date: date,
    data_mode: str,
    generated_at_utc: datetime | None = None,
) -> DashboardPayload:
    generated_at = generated_at_utc or datetime.now(UTC)
    points = compute_signal_history(spread_series)
    latest = points[-1] if points else None
    confidence = "unavailable" if latest is None else freshness(latest.date, as_of_date)
    state = "insufficient_data" if latest is None else latest.state
    score = None if latest is None else latest.score
    if confidence == "unavailable" and latest is not None:
        state = "data_stale"
        score = None

    average = None if latest is None else latest.moving_average_5d
    latest_observation = None
    if latest is not None:
        latest_observation = LatestObservation(
            series_id=spread_series.series_id,
            date=latest.date,
            value=latest.value,
            unit=spread_series.units,
            source_url=spread_series.source_url,
        )

    if state == "data_stale":
        explanation = (
            "The latest observation is more than 10 calendar days old, so the current score "
            "is not displayed."
        )
    elif latest is None or latest.score is None:
        explanation = "At least five valid observations are required to calculate the signal."
    else:
        explanation = (
            f"Based on the five-observation average, {STATE_LABELS[state]}. "
            "This score measures signal intensity; it is not a certain recession probability."
        )

    return DashboardPayload(
        data_mode=data_mode,
        generated_at_utc=generated_at,
        score=score,
        phase=phase_for_score(score),
        state=state,
        score_change_7d=None if score is None else score_change_7d(points),
        confidence=confidence,
        explanation_en=explanation,
        latest_observation=latest_observation,
        drivers=_drivers(state, average, confidence),
        spread_history=points,
        recession_periods=recession_periods(recession_series),
        backtest=build_backtest_report(points, recession_series),
        sources=[
            SourceInfo(
                series_id=series.series_id,
                title=series.title,
                url=series.source_url,
                fetched_at_utc=series.fetched_at_utc,
            )
            for series in (spread_series, recession_series)
        ],
    )


def run_pipeline(
    *,
    output_path: Path,
    as_of_date: date,
    fixtures_dir: Path | None = None,
    raw_dir: Path | None = None,
) -> DashboardPayload:
    if fixtures_dir is not None:
        spread = load_fixture_series(fixtures_dir, "T10Y2Y")
        recession = load_fixture_series(fixtures_dir, "USREC")
        data_mode = "fixture"
    else:
        api_key = os.getenv("FRED_API_KEY", "")
        client = FredClient(api_key)
        spread = client.fetch_series("T10Y2Y")
        recession = client.fetch_series("USREC")
        data_mode = "live"

    payload = build_payload(
        spread,
        recession,
        as_of_date=as_of_date,
        data_mode=data_mode,
    )
    serialized = payload.model_dump(mode="json")

    if raw_dir is not None:
        raw_dir.mkdir(parents=True, exist_ok=True)
        for series in (spread, recession):
            _atomic_json_write(raw_dir / f"{series.series_id}.json", series.model_dump(mode="json"))
    _atomic_json_write(output_path, serialized)
    return payload


def _atomic_json_write(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary.replace(path)
