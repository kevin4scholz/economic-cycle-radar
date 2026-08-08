from __future__ import annotations

from statistics import median

import pandas as pd

from .models import BacktestReport, RecessionPeriod, SeriesData, SignalPoint


def recession_periods(series: SeriesData) -> list[RecessionPeriod]:
    observations = [item for item in series.observations if item.value is not None]
    periods: list[RecessionPeriod] = []
    start = None
    previous_date = None
    for item in observations:
        active = item.value >= 0.5
        if active and start is None:
            start = item.observation_date
        if not active and start is not None and previous_date is not None:
            periods.append(RecessionPeriod(start=start, end=previous_date))
            start = None
        previous_date = item.observation_date
    if start is not None and previous_date is not None:
        periods.append(RecessionPeriod(start=start, end=previous_date))
    return periods


def _transition_dates(points: list[SignalPoint], state: str) -> list[pd.Timestamp]:
    dates: list[pd.Timestamp] = []
    previous_state = None
    for point in points:
        if point.state == state and previous_state != state:
            dates.append(pd.Timestamp(point.date))
        previous_state = point.state
    return dates


def build_backtest_report(
    points: list[SignalPoint], recession_series: SeriesData, horizon_months: int = 12
) -> BacktestReport:
    inversions = _transition_dates(points, "inverted")
    re_steepenings = _transition_dates(points, "re_steepening")
    periods = recession_periods(recession_series)
    recession_starts = [pd.Timestamp(period.start) for period in periods]

    matched = 0
    lead_months: list[float] = []
    matched_recessions: set[pd.Timestamp] = set()
    for signal_date in re_steepenings:
        horizon = signal_date + pd.DateOffset(months=horizon_months)
        next_recessions = [date for date in recession_starts if signal_date <= date <= horizon]
        if next_recessions:
            next_recession = next_recessions[0]
            matched += 1
            matched_recessions.add(next_recession)
            lead_months.append((next_recession - signal_date).days / 30.4375)

    false_alarms = len(re_steepenings) - matched
    precision = matched / len(re_steepenings) if re_steepenings else None
    recall = len(matched_recessions) / len(recession_starts) if recession_starts else None
    false_alarm_rate = false_alarms / len(re_steepenings) if re_steepenings else None
    return BacktestReport(
        inversion_events=len(inversions),
        re_steepening_events=len(re_steepenings),
        recession_starts=len(recession_starts),
        matched_signals=matched,
        false_alarms=false_alarms,
        precision=None if precision is None else round(precision, 4),
        recall=None if recall is None else round(recall, 4),
        false_alarm_rate=None if false_alarm_rate is None else round(false_alarm_rate, 4),
        median_lead_months=None if not lead_months else round(median(lead_months), 2),
        note_en=(
            "This descriptive backtest uses one indicator and currently revised data. "
            "Its results do not guarantee future performance."
        ),
    )
