import { workspaceSchema } from '../../src/lib/workspace-validation'
import { getUser } from '@netlify/identity'
import { eq, and, sql } from 'drizzle-orm'
import { database } from '../../db/index'
import { workspaces } from '../../db/schema'
export default async (req: Request) => {
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
    if (revision === 0)
      await db
        .insert(workspaces)
        .values({ userId: user.id, data, revision: 0 })
        .onConflictDoNothing()
    const [saved] = await db
      .update(workspaces)
      .set({
        data,
        revision: sql`${workspaces.revision} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(eq(workspaces.userId, user.id), eq(workspaces.revision, revision)),
      )
      .returning({ revision: workspaces.revision })
    if (!saved)
      return Response.json(
        {
          error:
            'This workspace changed in another tab. Export your draft, then reload to avoid overwriting it.',
        },
        { status: 409 },
      )
    return Response.json(saved)
  } catch {
    return Response.json(
      {
        error:
          'Cloud saving is unavailable. Export a recovery backup before leaving, and retry when connected.',
      },
      { status: 503 },
    )
  }
}
export const config = { path: '/api/workspace' }
