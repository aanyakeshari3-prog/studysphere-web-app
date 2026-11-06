// Compare committed server snapshots. Client activity arrays and content are never copied to logs.
export function workspaceEvents(
  before: Record<string, unknown> | null,
  after: Record<string, unknown>,
) {
  const events: { type: string; feature: string; count: number }[] = []
  // Initial import is a baseline, not thousands of invented historical creation events.
  if (!before)
    return [{ type: 'workspace.initialized', feature: 'study-tools', count: 1 }]
  for (const [key, feature, label] of [
    ['notes', 'notes', 'note'],
    ['tasks', 'tasks', 'task'],
    ['cards', 'flashcards', 'flashcard'],
    ['focusSessions', 'study-tools', 'focus-session'],
    ['notebooks', 'study-tools', 'notebook'],
  ] as const) {
    const previous = new Map(
      ((before[key] || []) as { id: string }[]).map((v) => [v.id, v]),
    )
    const next = (after[key] || []) as {
      id: string
      deletedAt?: string
      completed?: boolean
    }[]
    const counts: Record<string, number> = {}
    for (const item of next) {
      const old = previous.get(item.id) as typeof item | undefined
      const action = !old
        ? 'created'
        : !old.deletedAt && item.deletedAt
          ? 'deleted'
          : !old.completed && item.completed
            ? 'completed'
            : JSON.stringify({ ...old, viewedAt: undefined }) !==
                JSON.stringify({ ...item, viewedAt: undefined })
              ? 'updated'
              : ''
      if (action) counts[action] = (counts[action] || 0) + 1
      previous.delete(item.id)
    }
    counts.deleted =
      (counts.deleted || 0) +
      [...previous.values()].filter(
        (v) => !(v as { deletedAt?: string }).deletedAt,
      ).length
    for (const [action, count] of Object.entries(counts))
      if (count) events.push({ type: `${label}.${action}`, feature, count })
  }
  if (JSON.stringify(before.prefs) !== JSON.stringify(after.prefs))
    events.push({ type: 'settings.updated', feature: 'settings', count: 1 })
  return events
}
