export async function api<T = unknown>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin', ...init })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(
      body.error || `Request failed (${response.status}). Please try again.`,
    )
  }
  return response.json()
}
export function exportJson(value: unknown, name = 'studysphere-backup.json') {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  )
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
