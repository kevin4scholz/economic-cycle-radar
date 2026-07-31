from pathlib import Path

from economic_cycle_radar.backtest import build_backtest_report, recession_periods
from economic_cycle_radar.fred import load_fixture_series
from economic_cycle_radar.scoring import compute_signal_history

FIXTURES = Path(__file__).parent / "fixtures"


def test_backtest_reports_events_and_recession_periods():
    spread = load_fixture_series(FIXTURES, "T10Y2Y")
    recession = load_fixture_series(FIXTURES, "USREC")
    report = build_backtest_report(compute_signal_history(spread), recession)

    assert report.inversion_events == 1
    assert report.re_steepening_events == 1
    assert report.matched_signals == 1
    assert report.precision == 1.0
    assert len(recession_periods(recession)) == 2

