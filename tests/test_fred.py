from datetime import UTC, datetime

import pytest

from economic_cycle_radar.fred import FredClient, FredError, parse_fred_payload


def test_missing_value_is_null_and_duplicate_keeps_last_value():
    result = parse_fred_payload(
        "TEST",
        {"title": "Test", "units": "Percent", "frequency": "Daily"},
        {
            "observations": [
                {"date": "2024-01-02", "value": "."},
                {"date": "2024-01-01", "value": "-0.25"},
                {"date": "2024-01-02", "value": "0.10"},
            ]
        },
        fetched_at_utc=datetime(2024, 1, 3, tzinfo=UTC),
    )

    assert [item.observation_date.isoformat() for item in result.observations] == [
        "2024-01-01",
        "2024-01-02",
    ]
    assert result.observations[0].value == -0.25
    assert result.observations[1].value == 0.10


def test_missing_api_key_fails_without_network_request():
    with pytest.raises(FredError, match="FRED_API_KEY"):
        FredClient("  ")

