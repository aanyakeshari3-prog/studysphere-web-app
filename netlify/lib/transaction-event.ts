import type { database } from '../../db/index'
import { activityEvents, adminAccounts } from '../../db/schema'
import { eq } from 'drizzle-orm'
type Transaction = Parameters<
  Parameters<ReturnType<typeof database>['transaction']>[0]
>[0]
export async function transactionEvent(
  tx: Transaction,
  userId: string,
  type: string,
  feature: string,
  metadata: Record<string, number> = {},
) {
  await tx
    .insert(activityEvents)
    .values({
      id: crypto.randomUUID(),
      userId,
      type,
      feature,
      status: 'success',
      metadata,
    })
  await tx
    .update(adminAccounts)
    .set({ lastActive: new Date() })
    .where(eq(adminAccounts.id, userId))
}
