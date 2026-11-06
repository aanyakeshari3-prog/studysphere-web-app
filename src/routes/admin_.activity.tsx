import { createFileRoute } from '@tanstack/react-router'
import { AdminDashboard } from '@/components/admin/dashboard'
export const Route = createFileRoute('/admin_/activity')({
  validateSearch: (search: Record<string, unknown>) => ({
    user: typeof search.user === 'string' ? search.user : undefined,
  }),
  head: () => ({
    meta: [
      { title: 'Activity — StudySphere Admin' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: ActivityPage,
})
function ActivityPage() {
  const { user } = Route.useSearch()
  return <AdminDashboard initialSection="events" initialUserFilter={user} />
}
