import { useEffect } from 'react'
export function reportClientError(
  kind: 'exception' | 'unhandled-rejection' | 'render-error',
) {
  void fetch('/api/client-error', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind }),
    keepalive: true,
  }).catch(() => {})
}
export function MonitorErrors() {
  useEffect(() => {
    const error = () => reportClientError('exception')
    const rejection = () => reportClientError('unhandled-rejection')
    window.addEventListener('error', error)
    window.addEventListener('unhandledrejection', rejection)
    return () => {
      window.removeEventListener('error', error)
      window.removeEventListener('unhandledrejection', rejection)
    }
  }, [])
  return null
}
