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
  oauthLogin,
  getSettings,
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
  const [googleEnabled, setGoogleEnabled] = useState(false)
  useEffect(() => {
    // Only offer Google when it is enabled as an external provider in Identity.
    getSettings()
      .then((settings) => setGoogleEnabled(Boolean(settings.providers?.google)))
      .catch(() => setGoogleEnabled(false))
  }, [])
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
          'Sign-in could not be completed. The link may be invalid or expired, or the sign-in was cancelled. Please try again.',
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
        {googleEnabled && (mode === 'login' || mode === 'signup') && (
          <>
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              disabled={busy}
              onClick={() => {
                setBusy(true)
                setMessage('')
                try {
                  oauthLogin('google')
                } catch (error) {
                  setBusy(false)
                  setMessage(
                    error instanceof Error
                      ? error.message
                      : 'Google sign-in is unavailable.',
                  )
                }
              }}
            >
              <GoogleIcon />
              Continue with Google
            </Button>
            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or use email
              <span className="h-px flex-1 bg-border" />
            </div>
          </>
        )}
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

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.11A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.28A7.2 7.2 0 0 1 4.91 12c0-.79.14-1.56.38-2.28V6.61H1.28a12 12 0 0 0 0 10.78l4.01-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.61l4.01 3.11C6.23 6.88 8.88 4.77 12 4.77Z"
      />
    </svg>
  )
}
