import { MonitorErrors } from '@/components/monitor-errors'
import { api } from './api'
import { useEffect, useState, createContext, useContext } from 'react'
import {
  getUser,
  signup,
  logout,
  handleAuthCallback,
  updateUser,
  onAuthChange,
} from '@netlify/identity'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
const AuthContext = createContext({ userId: '', signOut: async () => {} })
export const useAuth = () => useContext(AuthContext)
export function AuthGate({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState('')
  const [ready, setReady] = useState(false)
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const off = onAuthChange((_event, user) => setUserId(user?.id ?? ''))
    void (async () => {
      try {
        const result = await handleAuthCallback()
        if (result?.type === 'recovery') setMode('reset')
        const user = await getUser()
        setUserId(user?.id ?? '')
      } catch {
        setMessage(
          'The sign-in link is invalid or expired. Request a new link.',
        )
      } finally {
        setReady(true)
      }
    })()
    return off
  }, [])
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      if (mode === 'reset') {
        await updateUser({ password })
        setMode('login')
        setMessage('Password updated.')
      } else if (mode === 'recover') {
        await api('/api/auth-access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'recover', email }),
        })
        setMessage('Check your email for a recovery link.')
      } else if (mode === 'signup') {
        const user = await signup(email, password)
        if (user.confirmedAt) setUserId(user.id)
        else
          setMessage('Check your email to confirm your account, then sign in.')
      } else {
        await api('/api/auth-access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'login', email, password }),
        })
        window.location.reload()
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Account service unavailable.',
      )
    } finally {
      setBusy(false)
    }
  }
  if (!ready)
    return <div className="p-12 text-center">Opening your study space…</div>
  if (userId && mode !== 'reset')
    return (
      <AuthContext.Provider
        value={{
          userId,
          signOut: async () => {
            await fetch('/api/session-event', {
              method: 'POST',
              credentials: 'same-origin',
            }).catch(() => {})
            await logout()
            setUserId('')
          },
        }}
      >
        <div key={userId}>
          <MonitorErrors />
          {children}
        </div>
      </AuthContext.Provider>
    )
  return (
    <main className="grid min-h-screen place-items-center bg-background p-5">
      <div className="w-full max-w-md rounded-3xl border bg-card p-8 shadow-soft">
        <Logo />
        <p className="mt-8 text-xs font-semibold tracking-widest text-primary">
          YOUR PRIVATE STUDY SPACE
        </p>
        <h1 className="mt-3 text-3xl font-bold">Ideas worth keeping.</h1>
        <p className="mt-3 mb-7 text-sm text-muted-foreground">
          Notes, plans, and a little help making sense of it all. Sign in to
          save your work securely across devices.
        </p>
        <p className="mb-4 text-xs text-muted-foreground">
          We record account and feature usage metadata for security and service
          analytics. Activity is retained for 90 days and admin audit records
          for 365 days. Private notes, files, and AI conversations are excluded.
        </p>
        <form className="space-y-4" onSubmit={submit}>
          {mode !== 'reset' && (
            <label className="block text-sm">
              Email
              <Input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          )}
          {mode !== 'recover' && (
            <label className="block text-sm">
              Password
              <Input
                type="password"
                autoComplete={
                  mode === 'login' ? 'current-password' : 'new-password'
                }
                minLength={8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}
          <Button className="w-full" disabled={busy}>
            {busy
              ? 'Please wait…'
              : mode === 'signup'
                ? 'Create account'
                : mode === 'recover'
                  ? 'Send recovery link'
                  : mode === 'reset'
                    ? 'Save password'
                    : 'Sign in'}
          </Button>
          <p role="status" className="text-sm text-primary">
            {message}
          </p>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          {['login', 'signup', 'recover'].map((m) => (
            <Button
              key={m}
              variant="ghost"
              size="sm"
              onClick={() => {
                setMode(m)
                setMessage('')
              }}
            >
              {m === 'login'
                ? 'Sign in'
                : m === 'signup'
                  ? 'Create account'
                  : 'Forgot password'}
            </Button>
          ))}
        </div>
      </div>
    </main>
  )
}
