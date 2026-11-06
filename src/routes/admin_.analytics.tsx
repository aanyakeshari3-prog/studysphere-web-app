import { createFileRoute } from '@tanstack/react-router'
import { AdminDashboard } from '@/components/admin/dashboard'
export const Route = createFileRoute('/admin_/analytics')({
  head: () => ({
    meta: [
      { title: 'Analytics — StudySphere Admin' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: () => <AdminDashboard initialSection="analytics" />,
})
