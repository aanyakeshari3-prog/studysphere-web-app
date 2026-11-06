import { createFileRoute } from '@tanstack/react-router'
import { AdminDashboard } from '@/components/admin/dashboard'
export const Route = createFileRoute('/admin')({
  head: () => ({
    meta: [
      { title: 'Administration — StudySphere' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: AdminDashboard,
})
