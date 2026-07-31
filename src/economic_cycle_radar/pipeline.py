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
    "insufficient_data": "داده‌ی کافی وجود ندارد",
    "normal": "منحنی عادی است",
    "flattening": "منحنی در حال تخت‌شدن است",
    "inverted": "منحنی وارونه است",
    "re_steepening": "بازگشت از وارونگی ثبت شده است",
    "data_stale": "داده قدیمی است",
    "fetch_failed": "دریافت داده ناموفق بود",
}


def _drivers(state: str, average: float | None, confidence: str) -> list[Driver]:
    average_text = "ناموجود" if average is None else f"{average:.2f}٪"
    state_details = {
        "normal": "فاصله‌ی ۱۰ساله و ۲ساله بالاتر از آستانه‌ی ۰٫۵ است.",
        "flattening": "فاصله مثبت اما کمتر از ۰٫۵ است و باید روند آن پایش شود.",
        "inverted": "میانگین پنج‌روزه زیر صفر است؛ این هشدار فوری رکود نیست.",
        "re_steepening": "پس از وارونگی پایدار، منحنی دوباره مثبت شده است.",
        "data_stale": "به‌علت کهنگی داده، امتیاز فعلی منتشر نمی‌شود.",
        "insufficient_data": "کمتر از پنج مشاهده‌ی معتبر برای محاسبه وجود دارد.",
    }
    return [
        Driver(
            title_fa="میانگین پنج مشاهده",
            value=average_text,
            detail_fa="نوسان روزانه با میانگین پنج مشاهده هموار شده است.",
        ),
        Driver(
            title_fa="رژیم منحنی بازده",
            value=STATE_LABELS.get(state, state),
            detail_fa=state_details.get(state, "وضعیت فعلی از قواعد نسخه‌ی MVP استخراج شده است."),
        ),
        Driver(
            title_fa="کیفیت و تازگی",
            value={"high": "بالا", "medium": "متوسط", "unavailable": "ناموجود"}[confidence],
            detail_fa="تازگی فقط کیفیت داده را نشان می‌دهد، نه قطعیت پیش‌بینی را.",
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
            "آخرین داده بیش از ۱۰ روز با تاریخ ارزیابی فاصله دارد؛ "
            "امتیاز نمایش داده نمی‌شود."
        )
    elif latest is None or latest.score is None:
        explanation = "برای محاسبه‌ی سیگنال به حداقل پنج مشاهده‌ی معتبر نیاز است."
    else:
        explanation = (
            f"بر اساس میانگین پنج مشاهده، {STATE_LABELS[state]}. "
            "این عدد شدت سیگنال است، نه احتمال قطعی رکود."
        )

    return DashboardPayload(
        data_mode=data_mode,
        generated_at_utc=generated_at,
        score=score,
        phase=phase_for_score(score),
        state=state,
        score_change_7d=None if score is None else score_change_7d(points),
        confidence=confidence,
        explanation_fa=explanation,
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
