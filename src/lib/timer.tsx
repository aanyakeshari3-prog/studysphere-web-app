import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { toast } from 'sonner'
import { useStore } from './store'

export type TimerMode = 'focus' | 'break'
export type TimerStatus = 'idle' | 'running' | 'paused'

export const DURATIONS: Record<TimerMode, number> = {
  focus: 25 * 60,
  break: 5 * 60,
}

interface TimerValue {
  mode: TimerMode
  status: TimerStatus
  remaining: number
  total: number
  start: () => void
  pause: () => void
  resume: () => void
  reset: () => void
  switchMode: (mode: TimerMode) => void
}

const TimerContext = createContext<TimerValue | null>(null)

/** A short two-tone chime, generated so no audio file is needed. */
function playChime() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    const ctx = new Ctx()
    ;[660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = freq
      osc.type = 'sine'
      const t = ctx.currentTime + i * 0.25
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.65)
    })
    setTimeout(() => void ctx.close(), 1500)
  } catch {
    // Audio is optional.
  }
}

export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const { logFocusSession } = useStore()
  const [mode, setMode] = useState<TimerMode>('focus')
  const [status, setStatus] = useState<TimerStatus>('idle')
  const [remaining, setRemaining] = useState(DURATIONS.focus)
  // Wall-clock end time keeps the countdown accurate even if the tab is throttled.
  const endAt = useRef<number | null>(null)

  const complete = useCallback(
    (finished: TimerMode) => {
      endAt.current = null
      playChime()
      if (finished === 'focus') {
        logFocusSession(DURATIONS.focus / 60)
        toast.success('Focus session complete! 🎉', {
          description: 'Nice work. Time for a 5-minute break.',
        })
        setMode('break')
        setRemaining(DURATIONS.break)
      } else {
        toast.success('Break is over', {
          description: 'Ready for another focus session?',
        })
        setMode('focus')
        setRemaining(DURATIONS.focus)
      }
      setStatus('idle')
    },
    [logFocusSession],
  )

  useEffect(() => {
    if (status !== 'running') return
    const tick = () => {
      if (endAt.current === null) return
      const left = Math.max(0, Math.round((endAt.current - Date.now()) / 1000))
      setRemaining(left)
      if (left === 0) complete(mode)
    }
    const interval = window.setInterval(tick, 250)
    return () => window.clearInterval(interval)
  }, [status, mode, complete])

  // Show the countdown in the browser tab while it runs, then restore the page title.
  const savedTitle = useRef<string | null>(null)
  useEffect(() => {
    const base = 'StudySphere'
    if (status === 'idle') {
      if (savedTitle.current !== null) document.title = savedTitle.current
      savedTitle.current = null
      return
    }
    if (savedTitle.current === null) savedTitle.current = document.title
    const label = mode === 'focus' ? 'Focus' : 'Break'
    document.title = `${formatClock(remaining)} · ${label}${status === 'paused' ? ' (paused)' : ''} — ${base}`
  }, [remaining, status, mode])

  const value = useMemo<TimerValue>(
    () => ({
      mode,
      status,
      remaining,
      total: DURATIONS[mode],
      start() {
        endAt.current = Date.now() + DURATIONS[mode] * 1000
        setRemaining(DURATIONS[mode])
        setStatus('running')
      },
      pause() {
        endAt.current = null
        setStatus('paused')
      },
      resume() {
        endAt.current = Date.now() + remaining * 1000
        setStatus('running')
      },
      reset() {
        endAt.current = null
        setRemaining(DURATIONS[mode])
        setStatus('idle')
      },
      switchMode(next: TimerMode) {
        endAt.current = null
        setMode(next)
        setRemaining(DURATIONS[next])
        setStatus('idle')
      },
    }),
    [mode, status, remaining],
  )

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
}

export function useTimer(): TimerValue {
  const ctx = useContext(TimerContext)
  if (!ctx) throw new Error('useTimer must be used inside <TimerProvider>')
  return ctx
}
