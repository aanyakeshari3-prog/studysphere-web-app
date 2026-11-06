import { createFileRoute } from '@tanstack/react-router'
import { AdminDashboard } from '@/components/admin/dashboard'
export const Route = createFileRoute('/admin_/audit')({
  head: () => ({
    meta: [
      { title: 'Audit — StudySphere Admin' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: () => <AdminDashboard initialSection="audit" />,
})
