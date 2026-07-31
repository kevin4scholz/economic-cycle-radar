import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import sample from '../public/data/dashboard-data.json'

const fixtureSample = {
  ...sample,
  data_mode: 'fixture' as const,
  state: 're_steepening' as const,
  score: 85,
  phase: 'ریسک بسیار بالا / تنش اقتصادی',
}

vi.mock('echarts-for-react', () => ({
  default: ({ 'aria-label': ariaLabel }: { 'aria-label': string }) => <div aria-label={ariaLabel} />,
}))

describe('dashboard', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => fixtureSample }))
  })

  it('renders the Persian signal and fixture warning', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByText('اقتصاد در کدام فاز قرار دارد؟')).toBeInTheDocument())
    expect(screen.getByText(/نسخه‌ی آزمایشی/)).toBeInTheDocument()
    expect(screen.getByText('بازگشت از وارونگی')).toBeInTheDocument()
    expect(screen.getByText(/توصیه‌ی سرمایه‌گذاری/)).toBeInTheDocument()
  })
})
