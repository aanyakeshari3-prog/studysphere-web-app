import { createFileRoute } from '@tanstack/react-router'
import { AdminDashboard } from '@/components/admin/dashboard'
export const Route = createFileRoute('/admin_/users')({
  head: () => ({
    meta: [
      { title: 'Users — StudySphere Admin' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: () => <AdminDashboard initialSection="users" />,
})
