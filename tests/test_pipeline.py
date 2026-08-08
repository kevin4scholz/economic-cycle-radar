import json
from datetime import date
from pathlib import Path

import pytest

from economic_cycle_radar.fred import FredError
from economic_cycle_radar.pipeline import run_pipeline

FIXTURES = Path(__file__).parent / "fixtures"


def test_pipeline_writes_valid_fixture_payload(tmp_path: Path):
    output = tmp_path / "dashboard-data.json"
    payload = run_pipeline(
        output_path=output,
        fixtures_dir=FIXTURES,
        as_of_date=date(2021, 1, 20),
    )

    saved = json.loads(output.read_text(encoding="utf-8"))
    assert payload.data_mode == "fixture"
    assert saved["schema_version"] == "2.0.0"
    assert saved["state"] == "re_steepening"
    assert saved["score"] == 85
    assert len(saved["drivers"]) == 3
    assert saved["drivers"][0]["title_en"] == "Five-observation average"
    assert "explanation_en" in saved
    assert saved["recession_periods"][0] == {
        "start": "2020-03-01",
        "end": "2020-04-01",
    }


def test_missing_key_does_not_overwrite_previous_output(tmp_path: Path, monkeypatch):
    output = tmp_path / "dashboard-data.json"
    output.write_text('{"safe": true}', encoding="utf-8")
    monkeypatch.delenv("FRED_API_KEY", raising=False)

    with pytest.raises(FredError):
        run_pipeline(output_path=output, as_of_date=date(2026, 7, 31))

    assert output.read_text(encoding="utf-8") == '{"safe": true}'
