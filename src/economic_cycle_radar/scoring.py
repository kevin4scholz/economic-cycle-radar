from __future__ import annotations

from datetime import date, timedelta

import pandas as pd

from .models import SeriesData, SignalPoint

STATE_SCORES = {
    "normal": 15,
    "flattening": 40,
    "inverted": 70,
    "re_steepening": 85,
}


def compute_signal_history(series: SeriesData) -> list[SignalPoint]:
    rows = [
        {"date": item.observation_date, "value": item.value}
        for item in series.observations
        if item.value is not None
    ]
    if not rows:
        return []
    frame = pd.DataFrame(rows).drop_duplicates("date", keep="last").sort_values("date")
    frame["moving_average_5d"] = frame["value"].rolling(5, min_periods=5).mean()

    inversion_run = 0
    qualified_inversion = False
    positive_run = 0
    re_steepening_until: pd.Timestamp | None = None
    points: list[SignalPoint] = []

    for row in frame.itertuples(index=False):
        row_date = pd.Timestamp(row.date)
        average = None if pd.isna(row.moving_average_5d) else float(row.moving_average_5d)
        if average is None:
            state = "insufficient_data"
            score = None
        elif average < 0:
            inversion_run += 1
            qualified_inversion = qualified_inversion or inversion_run >= 10
            positive_run = 0
            re_steepening_until = None
            state = "inverted"
            score = STATE_SCORES[state]
        else:
            inversion_run = 0
            if qualified_inversion:
                positive_run += 1
            if qualified_inversion and positive_run >= 5:
                re_steepening_until = row_date + pd.DateOffset(months=12)
                qualified_inversion = False
                positive_run = 0
            if re_steepening_until is not None and row_date <= re_steepening_until:
                state = "re_steepening"
            elif average < 0.5:
                state = "flattening"
            else:
                state = "normal"
            score = STATE_SCORES[state]

        points.append(
            SignalPoint(
                date=row_date.date(),
                value=float(row.value),
                moving_average_5d=None if average is None else round(average, 4),
                state=state,
                score=score,
            )
        )
    return points


def freshness(latest_date: date, as_of_date: date) -> str:
    age = (as_of_date - latest_date).days
    if age < 0 or age > 10:
        return "unavailable"
    if age > 5:
        return "medium"
    return "high"


def score_change_7d(points: list[SignalPoint]) -> int | None:
    scored = [point for point in points if point.score is not None]
    if len(scored) < 2:
        return None
    latest = scored[-1]
    target = latest.date - timedelta(days=7)
    candidates = [point for point in scored[:-1] if point.date <= target]
    if not candidates:
        return None
    return latest.score - candidates[-1].score


def phase_for_score(score: int | None) -> str:
    if score is None:
        return "Data unavailable"
    if score <= 20:
        return "Expansion / low risk"
    if score <= 40:
        return "Growth with signs of slowing"
    if score <= 60:
        return "Caution / mixed signals"
    if score <= 80:
        return "Recession warning"
    return "Very high risk / economic stress"
