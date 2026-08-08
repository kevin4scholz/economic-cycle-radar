from __future__ import annotations

import json
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from .models import Observation, SeriesData

FRED_API_BASE = "https://api.stlouisfed.org/fred"
FRED_SERIES_URL = "https://fred.stlouisfed.org/series/{series_id}"


class FredError(RuntimeError):
    """A sanitized FRED error that never includes the API key."""


class FredClient:
    def __init__(
        self,
        api_key: str,
        *,
        timeout_seconds: float = 15.0,
        max_attempts: int = 3,
        transport: Any | None = None,
    ) -> None:
        if not api_key.strip():
            raise FredError("FRED_API_KEY is not configured.")
        self.api_key = api_key.strip()
        self.timeout_seconds = timeout_seconds
        self.max_attempts = max_attempts
        self.transport = transport

    def _get(self, endpoint: str, params: dict[str, str]) -> dict[str, Any]:
        import httpx

        safe_params = {**params, "api_key": self.api_key, "file_type": "json"}
        for attempt in range(1, self.max_attempts + 1):
            try:
                with httpx.Client(
                    timeout=self.timeout_seconds,
                    transport=self.transport,
                    headers={"User-Agent": "economic-cycle-radar/0.1"},
                ) as client:
                    response = client.get(f"{FRED_API_BASE}/{endpoint}", params=safe_params)
                    response.raise_for_status()
                    return response.json()
            except (httpx.HTTPError, ValueError):
                if attempt < self.max_attempts:
                    time.sleep(0.25 * (2 ** (attempt - 1)))
        raise FredError(
            f"FRED data fetch failed after {self.max_attempts} attempts."
        ) from None

    def fetch_series(self, series_id: str) -> SeriesData:
        metadata_payload = self._get("series", {"series_id": series_id})
        observations_payload = self._get("series/observations", {"series_id": series_id})
        series_items = metadata_payload.get("seriess", [])
        if not series_items:
            raise FredError(f"Series metadata for {series_id} is missing from the FRED response.")
        return parse_fred_payload(series_id, series_items[0], observations_payload)


def parse_fred_payload(
    series_id: str,
    metadata: dict[str, Any],
    observations_payload: dict[str, Any],
    *,
    fetched_at_utc: datetime | None = None,
) -> SeriesData:
    deduplicated: dict[str, Observation] = {}
    for item in observations_payload.get("observations", []):
        raw_value = item.get("value")
        value = None if raw_value in {None, ".", ""} else float(raw_value)
        observation = Observation(
            series_id=series_id,
            observation_date=item["date"],
            value=value,
            realtime_start=item.get("realtime_start"),
            realtime_end=item.get("realtime_end"),
        )
        deduplicated[observation.observation_date.isoformat()] = observation

    observations = sorted(deduplicated.values(), key=lambda item: item.observation_date)
    return SeriesData(
        series_id=series_id,
        title=metadata.get("title", series_id),
        units=metadata.get("units", "Percent"),
        frequency=metadata.get("frequency", "Unknown"),
        source_url=FRED_SERIES_URL.format(series_id=series_id),
        fetched_at_utc=fetched_at_utc or datetime.now(UTC),
        observations=observations,
    )


def load_fixture_series(fixtures_dir: Path, series_id: str) -> SeriesData:
    path = fixtures_dir / f"{series_id}.json"
    payload = json.loads(path.read_text(encoding="utf-8"))
    return parse_fred_payload(
        series_id,
        payload["metadata"],
        {"observations": payload["observations"]},
        fetched_at_utc=datetime.fromisoformat(payload["fetched_at_utc"].replace("Z", "+00:00")),
    )
