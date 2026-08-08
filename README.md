# Economic Cycle Radar

An explainable English dashboard for monitoring the US economic cycle. The MVP uses `T10Y2Y` as its single rule-based scoring input and `USREC` to display and evaluate official historical recession periods.

> This project is an educational decision-support tool. Its score is not a certain recession probability, investment advice, or a trading instruction.

## MVP status

- Analysis horizon: 12 months
- Model: `mvp-rule-v1`
- Data source: FRED / Federal Reserve Bank of St. Louis
- Interface: English, LTR, responsive, and accessible
- Public payload: `dashboard/public/data/dashboard-data.json`
- Live dashboard: [kevin4scholz.github.io/economic-cycle-radar](https://kevin4scholz.github.io/economic-cycle-radar/)

## Run locally with fixture data

Dependencies are declared in `pyproject.toml` and `dashboard/package.json`. After installing them:

```powershell
python -m economic_cycle_radar.cli `
  --fixtures tests/fixtures `
  --as-of 2021-01-20 `
  --output dashboard/public/data/dashboard-data.json

cd dashboard
pnpm dev
```

Fixture output is for development and testing only and is identified by `data_mode: fixture`.

## Run with live data

1. Copy `.env.example` to `.env`.
2. Enter `FRED_API_KEY` locally. Never paste it into chat or commit it.
3. Load the environment variable and run:

```powershell
python -m economic_cycle_radar.cli `
  --output dashboard/public/data/dashboard-data.json `
  --raw-dir data/raw
```

If the key is missing or the fetch fails, the command exits with an error and does not overwrite the previous output.

## Test and build

```powershell
pytest
ruff check .
cd dashboard
pnpm test --run
pnpm lint
pnpm build
```

See [docs/methodology.md](docs/methodology.md) for the scoring method and limitations.

## Contribution workflow

All changes use an `agent/*` feature branch, focused tests, an intentional commit, a push, and a Draft Pull Request into `main`. Do not commit directly to `main`.

GitHub Actions runs CI on each push and Pull Request. The scheduled dashboard workflow fetches fresh FRED data, validates it, builds the site, and deploys through GitHub Pages when `ENABLE_PAGES=true`. The FRED key remains only in the `FRED_API_KEY` Actions secret.
