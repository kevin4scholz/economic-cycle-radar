from __future__ import annotations

import argparse
import sys
from datetime import UTC, date, datetime
from pathlib import Path

from .fred import FredError
from .pipeline import run_pipeline


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="ساخت داده‌ی داشبورد رادار چرخه اقتصاد")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("dashboard/public/data/dashboard-data.json"),
    )
    parser.add_argument("--raw-dir", type=Path)
    parser.add_argument("--fixtures", type=Path)
    parser.add_argument(
        "--as-of",
        type=date.fromisoformat,
        default=datetime.now(UTC).date(),
        help="تاریخ ارزیابی به قالب YYYY-MM-DD",
    )
    return parser


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    args = build_parser().parse_args()
    try:
        payload = run_pipeline(
            output_path=args.output,
            raw_dir=args.raw_dir,
            fixtures_dir=args.fixtures,
            as_of_date=args.as_of,
        )
    except (FredError, OSError, ValueError) as exc:
        print(f"خطا: {exc}")
        return 2
    print(
        f"خروجی ساخته شد: {args.output} | حالت={payload.data_mode} | "
        f"وضعیت={payload.state} | امتیاز={payload.score}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
