import { createFileRoute } from '@tanstack/react-router'
import { AdminDashboard } from '@/components/admin/dashboard'
export const Route = createFileRoute('/admin_/users_/$userId')({
  head: () => ({
    meta: [
      { title: 'Account details — StudySphere Admin' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: UserPage,
})
function UserPage() {
  const { userId } = Route.useParams()
  return <AdminDashboard initialSection="users" initialUserId={userId} />
}
