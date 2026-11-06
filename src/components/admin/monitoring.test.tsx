import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, it, expect, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ api: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: mocks.api }))
import { Monitoring } from './monitoring'
const report = {
  stats: { total: 1, unresolved: 1, unread: 1, today: 1 },
  days: [],
  months: [],
  groups: [],
  users: [],
  rows: [
    {
      id: 'c03778b2-7aa4-4271-9947-528df999502d',
      code: 'upload: operation failed (storage_unavailable).',
      category: 'storage',
      feature: 'upload',
      status: 'unresolved',
      severity: 'high',
      occurrences: 2,
      environment: 'production',
      created_at: '2026-11-06T00:00:00Z',
    },
  ],
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.api.mockResolvedValue(report)
})
it('shows grouped safe errors and persists resolution through the owner endpoint', async () => {
  render(<Monitoring section="errors" refresh={0} />)
  const record = await screen.findByRole('button', {
    name: 'upload: operation failed (storage_unavailable).',
  })
  await userEvent.click(record)
  expect(screen.getByRole('dialog')).toHaveTextContent('production')
  await userEvent.click(screen.getByRole('button', { name: 'Resolve' }))
  await waitFor(() =>
    expect(mocks.api).toHaveBeenCalledWith(
      '/api/monitoring',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'resolve', id: report.rows[0].id }),
      }),
    ),
  )
})
it('shows unknown services when no real observations exist', async () => {
  mocks.api.mockResolvedValue({ ...report, rows: [], health: [], slowest: [] })
  render(<Monitoring section="performance" refresh={0} />)
  expect(await screen.findByText('Service observations')).toBeInTheDocument()
  expect(
    screen.getAllByText('Unknown').filter((el) => el.tagName !== 'OPTION'),
  ).toHaveLength(6)
  expect(screen.getAllByText('No probe recorded')).toHaveLength(6)
})
