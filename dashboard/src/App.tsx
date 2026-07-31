import { useEffect, useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import type { DashboardData, SignalState } from './types'

const STATE_LABELS: Record<SignalState, string> = {
  insufficient_data: 'داده ناکافی',
  normal: 'منحنی عادی',
  flattening: 'تخت‌شدن منحنی',
  inverted: 'وارونگی منحنی',
  re_steepening: 'بازگشت از وارونگی',
  data_stale: 'داده قدیمی',
  fetch_failed: 'خطای دریافت',
}

const SCORE_ZONES = [
  { range: '۰ تا ۲۰', label: 'ریسک پایین', className: 'zone-low' },
  { range: '۲۱ تا ۴۰', label: 'کندشدن', className: 'zone-watch' },
  { range: '۴۱ تا ۶۰', label: 'احتیاط', className: 'zone-caution' },
  { range: '۶۱ تا ۸۰', label: 'هشدار', className: 'zone-warning' },
  { range: '۸۱ تا ۱۰۰', label: 'تنش بالا', className: 'zone-high' },
]

function toFaNumber(value: number | null, maximumFractionDigits = 2) {
  if (value === null) return '—'
  return new Intl.NumberFormat('fa-IR', { maximumFractionDigits }).format(value)
}

function toFaDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('fa-IR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

function confidenceLabel(value: DashboardData['confidence']) {
  return { high: 'بالا', medium: 'متوسط', unavailable: 'ناموجود' }[value]
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
        setError('داده‌ی داشبورد بارگذاری نشد. لطفاً ساخت خط داده را بررسی کنید.')
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
          axisLabel: { distance: 28, color: '#9fb3c8', fontSize: 11 },
          anchor: { show: true, size: 14, itemStyle: { color: '#f7fafc', borderColor: '#07111f' } },
          title: { show: false },
          detail: {
            valueAnimation: true,
            offsetCenter: [0, '45%'],
            color: '#f7fafc',
            fontSize: 34,
            fontWeight: 800,
            formatter: (value: number) => toFaNumber(value, 0),
          },
          data: [{ value: score }],
        },
      ],
    }),
    [score],
  )
  return <ReactECharts option={option} style={{ height: 300 }} aria-label={`امتیاز سیگنال ${score} از ۱۰۰`} />
}

function HistoryChart({ data }: { data: DashboardData }) {
  const option = useMemo(() => {
    const recessionAreas = data.recession_periods.map((period) => [
      { xAxis: period.start, name: 'رکود' },
      { xAxis: period.end },
    ])
    return {
      animationDuration: 600,
      aria: { enabled: true, decal: { show: true } },
      grid: { top: 28, right: 26, bottom: 54, left: 55 },
      tooltip: {
        trigger: 'axis',
        valueFormatter: (value: number) => `${toFaNumber(value)}٪`,
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
        name: 'درصد',
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
            label: { formatter: 'خط صفر', color: '#b8c8d8' },
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

  return <ReactECharts option={option} style={{ height: 430 }} aria-label="نمودار تاریخی اختلاف بازده و دوره‌های رکود" />
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
      <main className="center-state" dir="rtl">
        <div className="status-icon" aria-hidden="true">!</div>
        <h1>داده در دسترس نیست</h1>
        <p>{error}</p>
      </main>
    )
  }

  if (!data) {
    return (
      <main className="center-state" dir="rtl" aria-live="polite">
        <div className="loader" aria-hidden="true" />
        <p>در حال آماده‌سازی رادار…</p>
      </main>
    )
  }

  const change = data.score_change_7d
  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="رفتن به ابتدای صفحه">
          <span className="brand-mark" aria-hidden="true">R</span>
          <span><strong>رادار چرخه اقتصاد</strong><small>Economic Cycle Radar</small></span>
        </a>
        <nav aria-label="ناوبری اصلی">
          <a href="#signal">سیگنال</a>
          <a href="#history">تاریخچه</a>
          <a href="#method">روش‌شناسی</a>
        </nav>
        <span className={`data-pill ${data.confidence}`}>کیفیت داده: {confidenceLabel(data.confidence)}</span>
      </header>

      <main id="top">
        {data.data_mode === 'fixture' && (
          <div className="demo-banner" role="status">
            نسخه‌ی آزمایشی با داده‌ی fixture — برای تحلیل واقعی، خط داده‌ی زنده را اجرا کنید.
          </div>
        )}

        <section className="hero" id="signal">
          <div className="hero-copy">
            <p className="eyebrow">پایش روزانه‌ی منحنی بازده آمریکا</p>
            <h1>اقتصاد در کدام فاز قرار دارد؟</h1>
            <p className="lead">یک سیگنال شفاف برای افق ۱۲ ماه؛ مبتنی بر داده‌ی رسمی و همراه با توضیح، نه پیش‌گویی.</p>
            <div className="signal-label">
              <span className={`state-dot state-${data.state}`} aria-hidden="true" />
              <div><small>وضعیت فعلی</small><strong>{STATE_LABELS[data.state]}</strong></div>
            </div>
            <p className="explanation">{data.explanation_fa}</p>
          </div>

          <article className="gauge-card">
            <div className="card-heading">
              <div><span>شدت سیگنال</span><small>از ۱۰۰ — احتمال قطعی نیست</small></div>
              <span className="horizon">افق ۱۲ ماه</span>
            </div>
            {data.score === null ? (
              <div className="no-score"><strong>—</strong><span>امتیاز به‌علت نبود یا کهنگی داده نمایش داده نمی‌شود.</span></div>
            ) : <Gauge score={data.score} />}
            <div className="gauge-footer"><strong>{data.phase}</strong><span>تغییر هفتگی: {change === null ? '—' : `${change > 0 ? '+' : ''}${toFaNumber(change, 0)}`}</span></div>
          </article>
        </section>

        <section className="metrics-grid" aria-label="خلاصه داده‌ی فعلی">
          <Metric label="آخرین T10Y2Y" value={data.latest_observation ? `${toFaNumber(data.latest_observation.value)}٪` : '—'} hint="۱۰ساله منهای ۲ساله" />
          <Metric label="تاریخ مشاهده" value={toFaDate(data.latest_observation?.date ?? null)} hint="تاریخ اقتصادی، بدون تبدیل timezone" />
          <Metric label="نسخه مدل" value={data.model_version} hint={`قرارداد داده ${data.schema_version}`} />
          <Metric label="آخرین ساخت" value={new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(data.generated_at_utc))} hint="زمان محلی دستگاه" />
        </section>

        <section className="drivers-section">
          <div className="section-heading"><div><p className="eyebrow">توضیح‌پذیری</p><h2>چرا این وضعیت نمایش داده می‌شود؟</h2></div><p>سه عامل اصلی امتیاز فعلی</p></div>
          <div className="drivers-grid">
            {data.drivers.map((driver, index) => (
              <article className="driver-card" key={driver.title_fa}>
                <span className="driver-index">۰{index + 1}</span>
                <h3>{driver.title_fa}</h3><strong>{driver.value}</strong><p>{driver.detail_fa}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="chart-card" id="history">
          <div className="section-heading"><div><p className="eyebrow">نمای تاریخی</p><h2>اختلاف بازده ۱۰ساله و ۲ساله</h2></div><p>ناحیه‌های هاشورخورده: دوره‌های رکود `USREC`</p></div>
          <HistoryChart data={data} />
          <p className="chart-note">عبور از صفر به‌تنهایی به معنی شروع فوری رکود نیست. برای بررسی جزئیات، روی نمودار حرکت یا بازه را جابه‌جا کنید.</p>
        </section>

        <section className="zones-section" aria-labelledby="zones-title">
          <div className="section-heading"><div><p className="eyebrow">راهنمای نشانگر</p><h2 id="zones-title">معنای ناحیه‌های امتیاز</h2></div></div>
          <div className="zones-grid">
            {SCORE_ZONES.map((zone) => <div className={`zone ${zone.className}`} key={zone.range}><span>{zone.range}</span><strong>{zone.label}</strong></div>)}
          </div>
        </section>

        <section className="method-grid" id="method">
          <article className="method-card">
            <p className="eyebrow">بک‌تست اولیه</p><h2>کارنامه‌ی توصیفی مدل</h2>
            <div className="backtest-grid">
              <Metric label="وارونگی‌ها" value={toFaNumber(data.backtest.inversion_events, 0)} />
              <Metric label="بازگشت‌ها" value={toFaNumber(data.backtest.re_steepening_events, 0)} />
              <Metric label="Precision" value={data.backtest.precision === null ? '—' : `${toFaNumber(data.backtest.precision * 100, 1)}٪`} />
              <Metric label="Recall" value={data.backtest.recall === null ? '—' : `${toFaNumber(data.backtest.recall * 100, 1)}٪`} />
            </div>
            <p className="method-note">{data.backtest.note_fa}</p>
          </article>
          <article className="method-card sources-card">
            <p className="eyebrow">شفافیت</p><h2>منابع و روش</h2>
            <p>امتیاز از میانگین پنج مشاهده و چهار رژیم قاعده‌محور ساخته می‌شود. `USREC` فقط برای نمایش و ارزیابی تاریخی است.</p>
            <ul>{data.sources.map((source) => <li key={source.series_id}><a href={source.url} target="_blank" rel="noreferrer">{source.series_id} — {source.title}</a></li>)}</ul>
            <a className="method-link" href="https://fred.stlouisfed.org/docs/api/fred/series_observations.html" target="_blank" rel="noreferrer">مستندات رسمی FRED API ↗</a>
          </article>
        </section>

        <section className="disclaimer" aria-label="سلب مسئولیت">
          <strong>یادآوری مهم</strong><p>این داشبورد ابزار آموزشی و تصمیم‌یار است؛ توصیه‌ی سرمایه‌گذاری، تضمین سود یا پیش‌بینی قطعی تاریخ رکود نیست.</p>
        </section>
      </main>

      <footer><span>رادار چرخه اقتصاد</span><span>اول صحت و توضیح‌پذیری، بعد پیچیدگی مدل.</span></footer>
    </div>
  )
}

export default App

