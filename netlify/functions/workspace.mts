import { workspaceEvents } from '../lib/workspace-events'
import { protectedHandler } from '../lib/protected-handler'
import { HttpError } from '../lib/admin-core'
import { workspaceSchema } from '../../src/lib/workspace-validation'
import { getUser } from '@netlify/identity'
import { eq, and, sql } from 'drizzle-orm'
import { database } from '../../db/index'
import { workspaces, activityEvents, adminAccounts } from '../../db/schema'
export default protectedHandler(async (req: Request) => {
  const user = await getUser()
  if (!user)
    return Response.json({ error: 'Please sign in again.' }, { status: 401 })
  try {
    const db = database()
    if (req.method === 'GET') {
      const [row] = await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.userId, user.id))
      return Response.json(row ?? { revision: 0, data: null }, {
        headers: { 'Cache-Control': 'private, no-store' },
      })
    }
    if (req.method !== 'PUT') return new Response(null, { status: 405 })
    if (
      req.headers.get('origin') &&
      req.headers.get('origin') !== new URL(req.url).origin
    )
      return new Response(null, { status: 403 })
    const raw = await req.text()
    if (raw.length > 4_000_000)
      return Response.json(
        { error: 'Workspace is too large. Export or shorten older notes.' },
        { status: 413 },
      )
    const { data: input, revision } = JSON.parse(raw)
    const parsed = workspaceSchema.safeParse(input)
    if (!Number.isInteger(revision) || revision < 0 || !parsed.success)
      return Response.json(
        {
          error:
            'Invalid workspace data. Export your recovery backup before reloading.',
        },
        { status: 400 },
      )
    const data = parsed.data
    const saved = await db.transaction(async (tx) => {
      const [previous] = await tx
        .select()
        .from(workspaces)
        .where(eq(workspaces.userId, user.id))
      if (revision === 0)
        await tx
          .insert(workspaces)
          .values({ userId: user.id, data, revision: 0 })
          .onConflictDoNothing()
      const [saved] = await tx
        .update(workspaces)
        .set({
          data,
          revision: sql`${workspaces.revision} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(workspaces.userId, user.id),
            eq(workspaces.revision, revision),
          ),
        )
        .returning({ revision: workspaces.revision })
      if (!saved)
        throw new HttpError(
          409,
          'This workspace changed in another tab. Export your draft, then reload to avoid overwriting it.',
        )
      const events = workspaceEvents(
        previous?.data as Record<string, unknown> | null,
        data,
      )
      if (events.length) {
        await tx
          .insert(activityEvents)
          .values(
            events.map((event) => ({
              id: crypto.randomUUID(),
              userId: user.id,
              type: event.type,
              feature: event.feature,
              status: 'success',
              metadata: { count: event.count },
              correlationId: `workspace:${user.id}:${saved.revision}`,
            })),
          )
        await tx
          .update(adminAccounts)
          .set({ lastActive: new Date() })
          .where(eq(adminAccounts.id, user.id))
      }
      await tx
        .update(adminAccounts)
        .set({ name: data.prefs.displayName })
        .where(eq(adminAccounts.id, user.id))
      return saved
    })
    return Response.json(saved)
  } catch (error) {
    if (error instanceof HttpError)
      return Response.json({ error: error.message }, { status: error.status })
    return Response.json(
      {
        error:
          'Cloud saving is unavailable. Export a recovery backup before leaving, and retry when connected.',
      },
      { status: 503 },
    )
  }
})
export const config = { path: '/api/workspace' }
