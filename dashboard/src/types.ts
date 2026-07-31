export type SignalState =
  | 'insufficient_data'
  | 'normal'
  | 'flattening'
  | 'inverted'
  | 're_steepening'
  | 'data_stale'
  | 'fetch_failed'

export interface SignalPoint {
  date: string
  value: number
  moving_average_5d: number | null
  state: SignalState
  score: number | null
}

export interface RecessionPeriod {
  start: string
  end: string
}

export interface Driver {
  title_fa: string
  value: string
  detail_fa: string
}

export interface BacktestReport {
  inversion_events: number
  re_steepening_events: number
  recession_starts: number
  matched_signals: number
  false_alarms: number
  precision: number | null
  recall: number | null
  false_alarm_rate: number | null
  median_lead_months: number | null
  note_fa: string
}

export interface DashboardData {
  schema_version: string
  model_version: string
  data_mode: 'live' | 'fixture'
  generated_at_utc: string
  horizon_months: 12
  score: number | null
  phase: string
  state: SignalState
  score_change_7d: number | null
  confidence: 'high' | 'medium' | 'unavailable'
  explanation_fa: string
  latest_observation: {
    series_id: string
    date: string
    value: number
    unit: string
    source_url: string
  } | null
  drivers: Driver[]
  spread_history: SignalPoint[]
  recession_periods: RecessionPeriod[]
  backtest: BacktestReport
  sources: Array<{
    series_id: string
    title: string
    url: string
    fetched_at_utc: string
  }>
}

