import { useEffect, useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import type { DashboardData, SignalState } from './types'

const STATE_LABELS: Record<SignalState, string> = {
  insufficient_data: 'Insufficient data',
  normal: 'Normal yield curve',
  flattening: 'Flattening yield curve',
  inverted: 'Inverted yield curve',
  re_steepening: 'Re-steepening after inversion',
  data_stale: 'Stale data',
  fetch_failed: 'Data fetch failed',
}

const SCORE_ZONES = [
  { range: '0–20', label: 'Low risk', className: 'zone-low' },
  { range: '21–40', label: 'Slowing', className: 'zone-watch' },
  { range: '41–60', label: 'Caution', className: 'zone-caution' },
  { range: '61–80', label: 'Warning', className: 'zone-warning' },
  { range: '81–100', label: 'High stress', className: 'zone-high' },
]

function formatNumber(value: number | null, maximumFractionDigits = 2) {
  if (value === null) return '—'
  return new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(value)
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

function confidenceLabel(value: DashboardData['confidence']) {
  return { high: 'High', medium: 'Medium', unavailable: 'Unavailable' }[value]
}

function useDashboardData() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`${import.meta.env.BASE_URL}data/dashboard-data.json`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<DashboardData>
      })
      .then(setData)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        setError('The dashboard data could not be loaded. Check the data pipeline and try again.')
      })
    return () => controller.abort()
  }, [])

  return { data, error }
}

function Gauge({ score }: { score: number }) {
  const option = useMemo(
    () => ({
      animationDuration: 900,
      series: [
        {
          type: 'gauge',
          min: 0,
          max: 100,
          startAngle: 210,
          endAngle: -30,
          radius: '98%',
          center: ['50%', '55%'],
          progress: { show: true, width: 18, roundCap: true, itemStyle: { color: '#ffb35b' } },
          pointer: { length: '60%', width: 6, itemStyle: { color: '#f7fafc' } },
          axisLine: {
            lineStyle: {
              width: 18,
              color: [
                [0.2, '#2dc9a5'],
                [0.4, '#77b98c'],
                [0.6, '#d8b44c'],
                [0.8, '#ef8c45'],
                [1, '#eb5c67'],
              ],
            },
          },
          axisTick: { distance: -26, length: 5, lineStyle: { color: '#07111f', width: 1 } },
          splitLine: { distance: -28, length: 11, lineStyle: { color: '#dbe8f4', width: 2 } },
          axisLabel: { distance: 28, color: '#9fb3c8', fontSize: 11, fontFamily: 'Manrope Variable' },
          anchor: { show: true, size: 14, itemStyle: { color: '#f7fafc', borderColor: '#07111f' } },
          title: { show: false },
          detail: {
            valueAnimation: true,
            offsetCenter: [0, '45%'],
            color: '#f7fafc',
            fontSize: 34,
            fontWeight: 800,
            fontFamily: 'Manrope Variable',
            formatter: (value: number) => formatNumber(value, 0),
          },
          data: [{ value: score }],
        },
      ],
    }),
    [score],
  )
  return <ReactECharts option={option} style={{ height: 300 }} aria-label={`Signal score ${score} out of 100`} />
}

function HistoryChart({ data }: { data: DashboardData }) {
  const option = useMemo(() => {
    const recessionAreas = data.recession_periods.map((period) => [
      { xAxis: period.start, name: 'Recession' },
      { xAxis: period.end },
    ])
    return {
      animationDuration: 600,
      aria: { enabled: true, decal: { show: true } },
      grid: { top: 28, right: 26, bottom: 54, left: 55 },
      tooltip: {
        trigger: 'axis',
        valueFormatter: (value: number) => `${formatNumber(value)}%`,
      },
      dataZoom: [
        { type: 'inside', start: Math.max(0, 100 - (3650 / Math.max(data.spread_history.length, 1)) * 100), end: 100 },
        { type: 'slider', height: 18, bottom: 8, borderColor: 'transparent', fillerColor: '#2dc9a533' },
      ],
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: data.spread_history.map((point) => point.date),
        axisLabel: { color: '#8ea3b8', formatter: (value: string) => value.slice(0, 7) },
        axisLine: { lineStyle: { color: '#294159' } },
      },
      yAxis: {
        type: 'value',
        name: 'Percent',
        nameTextStyle: { color: '#8ea3b8' },
        axisLabel: { color: '#8ea3b8' },
        splitLine: { lineStyle: { color: '#1b3045' } },
      },
      series: [
        {
          name: 'T10Y2Y',
          type: 'line',
          showSymbol: false,
          smooth: 0.18,
          lineStyle: { width: 2.5, color: '#58c9ff' },
          areaStyle: { color: '#58c9ff18' },
          data: data.spread_history.map((point) => point.value),
          markLine: {
            silent: true,
            symbol: 'none',
            label: { formatter: 'Zero line', color: '#b8c8d8' },
            lineStyle: { color: '#dbe8f4', width: 1.5 },
            data: [{ yAxis: 0 }],
          },
          markArea: {
            silent: true,
            itemStyle: { color: '#8693a529', decal: { symbol: 'rect', dashArrayX: [2, 3], dashArrayY: [3, 3] } },
            label: { color: '#b9c7d5', position: 'insideTop' },
            data: recessionAreas,
          },
        },
      ],
    }
  }, [data])

  return <ReactECharts option={option} style={{ height: 430 }} aria-label="Historical yield spread with recession periods" />
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </div>
  )
}

function App() {
  const { data, error } = useDashboardData()

  if (error) {
    return (
      <main className="center-state" dir="ltr">
        <div className="status-icon" aria-hidden="true">!</div>
        <h1>Data unavailable</h1>
        <p>{error}</p>
      </main>
    )
  }

  if (!data) {
    return (
      <main className="center-state" dir="ltr" aria-live="polite">
        <div className="loader" aria-hidden="true" />
        <p>Preparing the radar…</p>
      </main>
    )
  }

  const change = data.score_change_7d
  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Go to the top of the page">
          <span className="brand-mark" aria-hidden="true">R</span>
          <span><strong>Economic Cycle Radar</strong><small>Explainable macro signals</small></span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#signal">Signal</a>
          <a href="#history">History</a>
          <a href="#method">Methodology</a>
        </nav>
        <span className={`data-pill ${data.confidence}`}>Data quality: {confidenceLabel(data.confidence)}</span>
      </header>

      <main id="top">
        {data.data_mode === 'fixture' && (
          <div className="demo-banner" role="status">
            Fixture preview — run the live data pipeline before using this dashboard for current analysis.
          </div>
        )}

        <section className="hero" id="signal">
          <div className="hero-copy">
            <p className="eyebrow">Daily US yield-curve monitor</p>
            <h1>Where is the economy in the cycle?</h1>
            <p className="lead">A transparent 12-month signal built from official data and clear rules—not a prediction.</p>
            <div className="signal-label">
              <span className={`state-dot state-${data.state}`} aria-hidden="true" />
              <div><small>Current state</small><strong>{STATE_LABELS[data.state]}</strong></div>
            </div>
            <p className="explanation">{data.explanation_en}</p>
          </div>

          <article className="gauge-card">
            <div className="card-heading">
              <div><span>Signal intensity</span><small>Out of 100 — not a certain probability</small></div>
              <span className="horizon">12-month horizon</span>
            </div>
            {data.score === null ? (
              <div className="no-score"><strong>—</strong><span>The score is withheld because data is missing or stale.</span></div>
            ) : <Gauge score={data.score} />}
            <div className="gauge-footer"><strong>{data.phase}</strong><span>7-day change: {change === null ? '—' : `${change > 0 ? '+' : ''}${formatNumber(change, 0)}`}</span></div>
          </article>
        </section>

        <section className="metrics-grid" aria-label="Current data summary">
          <Metric label="Latest T10Y2Y" value={data.latest_observation ? `${formatNumber(data.latest_observation.value)}%` : '—'} hint="10-year minus 2-year Treasury yield" />
          <Metric label="Observation date" value={formatDate(data.latest_observation?.date ?? null)} hint="Economic date, without timezone conversion" />
          <Metric label="Model version" value={data.model_version} hint={`Data contract ${data.schema_version}`} />
          <Metric label="Last generated" value={new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(data.generated_at_utc))} hint="Your device's local time" />
        </section>

        <section className="drivers-section">
          <div className="section-heading"><div><p className="eyebrow">Explainability</p><h2>Why is this state showing?</h2></div><p>The three main drivers of the current score</p></div>
          <div className="drivers-grid">
            {data.drivers.map((driver, index) => (
              <article className="driver-card" key={driver.title_en}>
                <span className="driver-index">0{index + 1}</span>
                <h3>{driver.title_en}</h3><strong>{driver.value}</strong><p>{driver.detail_en}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="chart-card" id="history">
          <div className="section-heading"><div><p className="eyebrow">Historical view</p><h2>10-year minus 2-year Treasury spread</h2></div><p>Hatched areas: `USREC` recession periods</p></div>
          <HistoryChart data={data} />
          <p className="chart-note">Crossing zero does not mean a recession starts immediately. Hover over the chart or move the range control to explore the history.</p>
        </section>

        <section className="zones-section" aria-labelledby="zones-title">
          <div className="section-heading"><div><p className="eyebrow">Gauge guide</p><h2 id="zones-title">What the score zones mean</h2></div></div>
          <div className="zones-grid">
            {SCORE_ZONES.map((zone) => <div className={`zone ${zone.className}`} key={zone.range}><span>{zone.range}</span><strong>{zone.label}</strong></div>)}
          </div>
        </section>

        <section className="method-grid" id="method">
          <article className="method-card">
            <p className="eyebrow">Initial backtest</p><h2>Descriptive model record</h2>
            <div className="backtest-grid">
              <Metric label="Inversions" value={formatNumber(data.backtest.inversion_events, 0)} />
              <Metric label="Re-steepenings" value={formatNumber(data.backtest.re_steepening_events, 0)} />
              <Metric label="Precision" value={data.backtest.precision === null ? '—' : `${formatNumber(data.backtest.precision * 100, 1)}%`} />
              <Metric label="Recall" value={data.backtest.recall === null ? '—' : `${formatNumber(data.backtest.recall * 100, 1)}%`} />
            </div>
            <p className="method-note">{data.backtest.note_en}</p>
          </article>
          <article className="method-card sources-card">
            <p className="eyebrow">Transparency</p><h2>Sources and method</h2>
            <p>The score uses a five-observation average and four rule-based regimes. `USREC` is used only for visualization and historical evaluation.</p>
            <ul>{data.sources.map((source) => <li key={source.series_id}><a href={source.url} target="_blank" rel="noreferrer">{source.series_id} — {source.title}</a></li>)}</ul>
            <a className="method-link" href="https://fred.stlouisfed.org/docs/api/fred/series_observations.html" target="_blank" rel="noreferrer">Official FRED API documentation ↗</a>
          </article>
        </section>

        <section className="disclaimer" aria-label="Disclaimer">
          <strong>Important</strong>
          <div>
            <p>This dashboard is an educational decision-support tool. It is not investment advice, a profit guarantee, or a certain forecast of a recession date.</p>
            <p>This product uses the FRED® API but is not endorsed or certified by the Federal Reserve Bank of St. Louis.</p>
          </div>
        </section>
      </main>

      <footer><span>Economic Cycle Radar</span><span>Accuracy and explainability before model complexity.</span></footer>
    </div>
  )
}

export default App
