# MVP methodology

## Product question

The dashboard measures the intensity of a yield-curve signal associated with US recession risk over a 12-month horizon. The score is rule-based and is not a calibrated statistical probability.

## Data

- [`T10Y2Y`](https://fred.stlouisfed.org/series/T10Y2Y): 10-Year Treasury Constant Maturity Minus 2-Year Treasury Constant Maturity; daily and not seasonally adjusted.
- [`USREC`](https://fred.stlouisfed.org/series/USREC): monthly NBER-based US recession indicator; used only for chart shading and historical evaluation.

FRED's missing value marker (`.`) becomes `null` and is never treated as zero. Observation dates remain timezone-free; fetch and generation timestamps use UTC.

## `mvp-rule-v1`

The model first calculates the average of the five most recent valid `T10Y2Y` observations:

| State | Rule | Score |
|---|---|---:|
| `normal` | Average is at least `0.50` | 15 |
| `flattening` | Average is from `0` to below `0.50` | 40 |
| `inverted` | Average is below `0` | 70 |
| `re_steepening` | Five consecutive non-negative averages after at least ten consecutive negative averages | 85 |

The `re_steepening` regime lasts for at most 12 months and ends early if a new inversion occurs. No score is produced until five valid observations exist.

## Freshness and confidence

- `high`: latest observation is no more than 5 calendar days old.
- `medium`: latest observation is 6–10 calendar days old.
- `unavailable`: latest observation is more than 10 days old or has an invalid future date; the current score becomes `null`.

Freshness describes data quality. It does not measure forecast certainty, and market holidays are never converted into zero-valued observations.

## Backtest

The initial backtest reports transitions into inversion and re-steepening, time to the next `USREC` start, precision, recall, false-alarm rate, and median lead time. It is descriptive because the model uses one indicator and currently revised data. The results must not be interpreted as live performance or a guarantee.

A future research version should use ALFRED vintage data to reduce look-ahead and revision bias.

## Limitations

- The yield curve can produce false warnings and variable lead times.
- `USREC` is not a real-time recession label.
- Labor, credit, inflation, and real-activity indicators are not yet part of the score.
- Fibonacci analysis, exact crash dates, automated trading, and personalized financial advice are out of scope.
