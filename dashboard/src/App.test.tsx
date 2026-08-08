import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import sample from '../public/data/dashboard-data.json'

const fixtureSample = {
  ...sample,
  data_mode: 'fixture' as const,
  state: 're_steepening' as const,
  score: 85,
  phase: 'Very high risk / economic stress',
}

vi.mock('echarts-for-react', () => ({
  default: ({ 'aria-label': ariaLabel }: { 'aria-label': string }) => <div aria-label={ariaLabel} />,
}))

describe('dashboard', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => fixtureSample }))
  })

  it('renders the English signal and fixture warning', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByText('Where is the economy in the cycle?')).toBeInTheDocument())
    expect(screen.getByText(/Fixture preview/)).toBeInTheDocument()
    expect(screen.getByText('Re-steepening after inversion')).toBeInTheDocument()
    expect(screen.getByText(/not investment advice/)).toBeInTheDocument()
  })
})
