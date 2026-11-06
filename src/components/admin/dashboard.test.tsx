import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, it, expect, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  signOut: vi.fn(),
  updatePrefs: vi.fn(),
}))
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }))
vi.mock('@/lib/api', () => ({ api: mocks.api }))
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ signOut: mocks.signOut }) }))
vi.mock('@/lib/store', () => ({
  useStore: () => ({
    prefs: { theme: 'light' },
    updatePrefs: mocks.updatePrefs,
  }),
}))
vi.mock('@/components/ui/sonner', () => ({ Toaster: () => null }))
import { AdminDashboard } from './dashboard'
beforeEach(() => {
  vi.resetAllMocks()
})
it('shows access rejection without rendering administrative data', async () => {
  mocks.api.mockRejectedValue(new Error('Administrator access required.'))
  render(<AdminDashboard />)
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Administrator access required.',
  )
  expect(
    screen.queryByRole('button', { name: 'Sync accounts' }),
  ).not.toBeInTheDocument()
})
it('renders empty real analytics and sends date and user filters to the API', async () => {
  mocks.api.mockImplementation(async (url: string) => {
    if (url.includes('view=me'))
      return {
        id: 'owner',
        role: 'owner',
        name: 'Owner',
        email: 'owner@example.test',
      }
    if (url.includes('view=users')) return { rows: [], total: 0 }
    return {
      stats: { total_users: 0 },
      days: [],
      features: [],
      recent: [],
      sync: null,
    }
  })
  render(<AdminDashboard />)
  expect(await screen.findByText('Registered users')).toBeInTheDocument()
  expect(screen.getAllByText('No recorded data for this period.')).toHaveLength(
    2,
  )
  await userEvent.selectOptions(screen.getByLabelText('Report date range'), '7')
  await waitFor(() =>
    expect(
      mocks.api.mock.calls.some(
        ([url]) => url.includes('view=overview') && url.includes('range=7'),
      ),
    ).toBe(true),
  )
  await userEvent.click(screen.getByRole('button', { name: 'User management' }))
  expect(
    await screen.findByText('No records match these filters.'),
  ).toBeInTheDocument()
  await userEvent.selectOptions(
    screen.getByLabelText('Account filter'),
    'suspended',
  )
  await waitFor(() =>
    expect(
      mocks.api.mock.calls.some(
        ([url]) =>
          url.includes('view=users') && url.includes('filter=suspended'),
      ),
    ).toBe(true),
  )
})
