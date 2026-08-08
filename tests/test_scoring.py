from datetime import date
from pathlib import Path

from economic_cycle_radar.fred import load_fixture_series
from economic_cycle_radar.scoring import compute_signal_history, freshness, phase_for_score

FIXTURES = Path(__file__).parent / "fixtures"


def test_fixture_reaches_re_steepening_after_sustained_inversion():
    points = compute_signal_history(load_fixture_series(FIXTURES, "T10Y2Y"))

    assert any(point.state == "inverted" for point in points)
    assert points[-1].state == "re_steepening"
    assert points[-1].score == 85


def test_freshness_boundaries():
    latest = date(2026, 7, 20)
    assert freshness(latest, date(2026, 7, 25)) == "high"
    assert freshness(latest, date(2026, 7, 26)) == "medium"
    assert freshness(latest, date(2026, 7, 30)) == "medium"
    assert freshness(latest, date(2026, 7, 31)) == "unavailable"


def test_phase_boundaries():
    assert phase_for_score(20) == "Expansion / low risk"
    assert phase_for_score(40) == "Growth with signs of slowing"
    assert phase_for_score(60) == "Caution / mixed signals"
    assert phase_for_score(80) == "Recession warning"
    assert phase_for_score(81) == "Very high risk / economic stress"
