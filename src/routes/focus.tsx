import { useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Coffee, Flame, Pause, Play, RotateCcw, Target, Timer, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '@/lib/store'
import { DURATIONS, formatClock, useTimer, type TimerMode } from '@/lib/timer'
import { toDateKey } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { PageHeader } from '@/components/page-header'

export const Route = createFileRoute('/focus')({
  head: () => ({ meta: [{ title: 'Focus Timer — StudySphere' }] }),
  component: FocusPage,
})

const MODES: { id: TimerMode; label: string; icon: typeof Timer }[] = [
  { id: 'focus', label: 'Focus · 25 min', icon: Timer },
  { id: 'break', label: 'Short break · 5 min', icon: Coffee },
]

const TIPS = [
  'Put your phone in another room before you start.',
  'Pick one assignment and stick to it for the whole session.',
  'Stand up, stretch and drink water during breaks.',
  'After four focus sessions, reward yourself with a longer break.',
]

function FocusPage() {
  const timer = useTimer()
  const { focusSessions, prefs } = useStore()
  const { mode, status, remaining, total } = timer
  const progress = 1 - remaining / total

  const today = toDateKey()
  const stats = useMemo(() => {
    const todays = focusSessions.filter((s) => toDateKey(new Date(s.completedAt)) === today)
    return {
      count: todays.length,
      minutes: todays.reduce((sum, s) => sum + s.minutes, 0),
      total: focusSessions.length,
      recent: [...focusSessions].reverse().slice(0, 5),
    }
  }, [focusSessions, today])

  const r = 120
  const c = 2 * Math.PI * r

  const changeMode = (next: TimerMode) => {
    if (next === mode) return
    if (status === 'running' && !window.confirm('Switching modes will stop the current timer. Continue?')) return
    timer.switchMode(next)
    toast(next === 'focus' ? 'Focus mode — 25 minutes' : 'Short break — 5 minutes')
  }

  return (
    <div>
      <PageHeader
        icon={Timer}
        title="Focus Timer"
        description="Study in focused 25-minute sessions with short breaks in between."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card className="rounded-3xl shadow-soft">
          <CardContent className="flex flex-col items-center px-4 py-8 sm:py-10">
            <div role="radiogroup" aria-label="Timer mode" className="mb-8 inline-flex rounded-full bg-muted p-1">
              {MODES.map((m) => {
                const Icon = m.icon
                return (
                  <button
                    key={m.id}
                    role="radio"
                    aria-checked={mode === m.id}
                    onClick={() => changeMode(m.id)}
                    className={cn(
                      'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                      mode === m.id ? 'bg-card text-primary shadow-soft' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Icon className="size-4" />
                    {m.label}
                  </button>
                )
              })}
            </div>

            <div className="relative size-64 sm:size-72">
              <svg viewBox="0 0 260 260" className="size-full -rotate-90" aria-hidden="true">
                <defs>
                  <linearGradient id="timer-gradient" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" />
                    <stop offset="100%" stopColor={mode === 'focus' ? 'var(--chart-2)' : 'var(--chart-5)'} />
                  </linearGradient>
                </defs>
                <circle cx="130" cy="130" r={r} fill="none" strokeWidth="14" className="stroke-muted" />
                <circle
                  cx="130"
                  cy="130"
                  r={r}
                  fill="none"
                  strokeWidth="14"
                  strokeLinecap="round"
                  stroke="url(#timer-gradient)"
                  strokeDasharray={c}
                  strokeDashoffset={c - progress * c}
                  className="transition-[stroke-dashoffset] duration-300 ease-linear motion-reduce:transition-none"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">
                  {mode === 'focus' ? 'Focus' : 'Break'}
                </span>
                <span
                  className="font-display text-6xl font-extrabold tabular-nums sm:text-7xl"
                  role="timer"
                  aria-live="off"
                  aria-label={`${Math.floor(remaining / 60)} minutes ${remaining % 60} seconds remaining`}
                >
                  {formatClock(remaining)}
                </span>
                <span className="mt-1 text-sm text-muted-foreground">
                  {status === 'idle' ? 'Ready when you are' : status === 'paused' ? 'Paused' : mode === 'focus' ? 'Stay focused…' : 'Relax and recharge'}
                </span>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {status === 'idle' && (
                <Button size="lg" className="h-12 min-w-40 rounded-full bg-brand text-base text-white shadow-glow hover:opacity-95" onClick={timer.start}>
                  <Play className="fill-current" /> Start
                </Button>
              )}
              {status === 'running' && (
                <Button size="lg" className="h-12 min-w-40 rounded-full text-base" onClick={timer.pause}>
                  <Pause className="fill-current" /> Pause
                </Button>
              )}
              {status === 'paused' && (
                <Button size="lg" className="h-12 min-w-40 rounded-full bg-brand text-base text-white shadow-glow hover:opacity-95" onClick={timer.resume}>
                  <Play className="fill-current" /> Resume
                </Button>
              )}
              <Button
                size="lg"
                variant="outline"
                className="h-12 rounded-full text-base"
                onClick={() => {
                  timer.reset()
                  toast('Timer reset')
                }}
                disabled={status === 'idle' && remaining === DURATIONS[mode]}
              >
                <RotateCcw /> Reset
              </Button>
              {mode === 'focus' && status === 'idle' && (
                <Button size="lg" variant="ghost" className="h-12 rounded-full text-base" onClick={() => changeMode('break')}>
                  <Coffee /> Take a short break
                </Button>
              )}
            </div>
            <p className="mt-6 text-center text-xs text-muted-foreground">
              The timer keeps running while you use other pages. A chime plays when time is up.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-2xl shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <Target className="size-5 text-primary" /> Today
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-muted/60 p-3">
                  <Flame className="mx-auto size-5 text-amber-500" />
                  <p className="mt-1 font-display text-xl font-extrabold tabular-nums">{stats.count}</p>
                  <p className="text-[11px] text-muted-foreground">Sessions</p>
                </div>
                <div className="rounded-xl bg-muted/60 p-3">
                  <Timer className="mx-auto size-5 text-primary" />
                  <p className="mt-1 font-display text-xl font-extrabold tabular-nums">{stats.minutes}</p>
                  <p className="text-[11px] text-muted-foreground">Minutes</p>
                </div>
                <div className="rounded-xl bg-muted/60 p-3">
                  <Trophy className="mx-auto size-5 text-violet-500" />
                  <p className="mt-1 font-display text-xl font-extrabold tabular-nums">{stats.total}</p>
                  <p className="text-[11px] text-muted-foreground">All time</p>
                </div>
              </div>
              <div>
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-semibold">Daily goal</span>
                  <span className="tabular-nums text-muted-foreground">
                    {stats.count}/{prefs.dailyFocusGoal} sessions
                  </span>
                </div>
                <Progress value={Math.min(100, (stats.count / prefs.dailyFocusGoal) * 100)} />
                {stats.count >= prefs.dailyFocusGoal && (
                  <p className="mt-2 text-sm font-medium text-emerald-600 dark:text-success">
                    🎉 Goal reached — brilliant work today!
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-soft">
            <CardHeader>
              <CardTitle className="font-display text-lg">Recent sessions</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.recent.length ? (
                <ul className="space-y-2 text-sm">
                  {stats.recent.map((s) => (
                    <li key={s.id} className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2">
                      <span className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-primary" />
                        {s.minutes} min focus
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(s.completedAt).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-xl bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">
                  Complete a 25-minute session and it will show up here.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl bg-accent/60 shadow-soft">
            <CardContent className="py-5">
              <p className="mb-2 text-sm font-bold text-accent-foreground">Focus tips</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {TIPS.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
