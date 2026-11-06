export type AdminUser = {
  id: string
  name: string
  email: string
  role: string
  status: string
  registered_at: string | null
  verified_at: string | null
  last_login: string | null
  last_active: string | null
}
export type AdminEvent = {
  id: string
  user_id?: string
  admin_id?: string
  target_id?: string
  type?: string
  action?: string
  feature?: string
  status?: string
  result?: string
  name?: string
  email?: string
  created_at: string
  metadata: Record<string, unknown>
  correlation_id?: string
}
export type AdminOverview = {
  stats: Record<string, number>
  days: {
    date: string
    events: number
    active: number
    registrations: number
  }[]
  features: { feature: string; events: number; users: number }[]
  recent: AdminEvent[]
  sync: { completedAt: string | null; nextPage?: number } | null
  start: string
  end: string
}
