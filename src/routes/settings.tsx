import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  BookOpenText,
  CalendarDays,
  ClipboardList,
  Database,
  Download,
  Heart,
  LayoutDashboard,
  Moon,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  Timer,
  Trash2,
  User,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Theme } from '@/lib/types'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/page-header'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { FieldError } from '@/components/field-error'
import { LogoMark } from '@/components/logo'

export const Route = createFileRoute('/settings')({
  head: () => ({ meta: [{ title: 'Settings & About — StudySphere' }] }),
  component: SettingsPage,
})

const FEATURES = [
  { icon: LayoutDashboard, title: 'Dashboard', text: 'Your day at a glance: priorities, deadlines and progress.' },
  { icon: ClipboardList, title: 'Homework manager', text: 'Track assignments by subject, due date and priority.' },
  { icon: BookOpenText, title: 'Digital notes', text: 'Write, search and organise notes by subject.' },
  { icon: Timer, title: 'Focus timer', text: '25-minute focus sessions with short breaks.' },
  { icon: CalendarDays, title: 'Weekly timetable', text: 'See your classes for every day of the week.' },
]

function SettingsPage() {
  const store = useStore()
  const { prefs, updatePrefs, tasks, notes, classes, subjects, focusSessions } = store
  const [name, setName] = useState(prefs.displayName)
  const [nameError, setNameError] = useState<string>()
  const [resetOpen, setResetOpen] = useState(false)
  const [sampleOpen, setSampleOpen] = useState(false)

  useEffect(() => setName(prefs.displayName), [prefs.displayName])

  const saveName = (e: React.FormEvent) => {
    e.preventDefault()
    const value = name.trim()
    if (value.length > 30) {
      setNameError('Keep your name under 30 characters.')
      return
    }
    if (value && !/^[\p{L}\p{M}' .-]+$/u.test(value)) {
      setNameError('Use letters, spaces, apostrophes or hyphens only.')
      return
    }
    setNameError(undefined)
    updatePrefs({ displayName: value })
    toast.success(value ? `Nice to meet you, ${value}!` : 'Display name cleared')
  }

  const setTheme = (theme: Theme) => {
    updatePrefs({ theme })
    toast.success(theme === 'dark' ? 'Dark mode on' : 'Light mode on')
  }

  const exportData = () => {
    const blob = new Blob(
      [JSON.stringify({ exportedAt: new Date().toISOString(), tasks, notes, subjects, timetable: classes, focusSessions, preferences: prefs }, null, 2)],
      { type: 'application/json' },
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `studysphere-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Backup downloaded')
  }

  return (
    <div>
      <PageHeader icon={Settings} title="Settings & About" description="Personalise StudySphere and learn what it’s for." />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card className="rounded-2xl shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <User className="size-5 text-primary" /> Profile
              </CardTitle>
              <CardDescription>Your name appears in the dashboard greeting.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={saveName} noValidate className="grid gap-2">
                <Label htmlFor="display-name">Display name</Label>
                <div className="flex gap-2">
                  <Input
                    id="display-name"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      setNameError(undefined)
                    }}
                    placeholder="e.g. Alex"
                    aria-invalid={!!nameError}
                    aria-describedby={nameError ? 'display-name-error' : undefined}
                    autoComplete="given-name"
                  />
                  <Button type="submit" disabled={name.trim() === prefs.displayName}>
                    Save
                  </Button>
                </div>
                <FieldError id="display-name-error" message={nameError} />
              </form>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <Sparkles className="size-5 text-primary" /> Appearance
              </CardTitle>
              <CardDescription>Choose how StudySphere looks on this device.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 gap-3">
                {(
                  [
                    { id: 'light', label: 'Light', icon: Sun },
                    { id: 'dark', label: 'Dark', icon: Moon },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    role="radio"
                    aria-checked={prefs.theme === t.id}
                    onClick={() => setTheme(t.id)}
                    className={cn(
                      'overflow-hidden rounded-2xl border-2 text-left transition-all focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                      prefs.theme === t.id ? 'border-primary shadow-glow' : 'border-border hover:border-primary/40',
                    )}
                  >
                    <div className={cn('flex h-20 gap-2 p-3', t.id === 'dark' ? 'bg-[#1b1830]' : 'bg-[#f6f5fc]')}>
                      <div className={cn('w-1/4 rounded-md', t.id === 'dark' ? 'bg-[#25213d]' : 'bg-white')} />
                      <div className="flex flex-1 flex-col gap-1.5">
                        <div className="h-4 rounded-md bg-gradient-to-r from-indigo-500 to-purple-500" />
                        <div className={cn('flex-1 rounded-md', t.id === 'dark' ? 'bg-[#25213d]' : 'bg-white')} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 text-sm font-semibold">
                      <t.icon className="size-4" /> {t.label}
                    </div>
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
                <Label htmlFor="dark-switch" className="cursor-pointer">Dark mode</Label>
                <Switch
                  id="dark-switch"
                  checked={prefs.theme === 'dark'}
                  onCheckedChange={(on) => setTheme(on ? 'dark' : 'light')}
                />
              </div>
              <div className="hidden items-center justify-between rounded-xl bg-muted/50 px-4 py-3 lg:flex">
                <Label htmlFor="sidebar-switch" className="cursor-pointer">Compact sidebar</Label>
                <Switch
                  id="sidebar-switch"
                  checked={prefs.sidebarCollapsed}
                  onCheckedChange={(on) => updatePrefs({ sidebarCollapsed: on })}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <Target className="size-5 text-primary" /> Study goal
              </CardTitle>
              <CardDescription>How many 25-minute focus sessions do you aim for each day?</CardDescription>
            </CardHeader>
            <CardContent>
              <Label htmlFor="goal" className="sr-only">Daily focus goal</Label>
              <Select
                value={String(prefs.dailyFocusGoal)}
                onValueChange={(v) => {
                  updatePrefs({ dailyFocusGoal: Number(v) })
                  toast.success(`Daily goal set to ${v} session${v === '1' ? '' : 's'}`)
                }}
              >
                <SelectTrigger id="goal" className="w-full sm:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} session{n === 1 ? '' : 's'} ({(n * 25 / 60).toFixed(1).replace('.0', '')} h)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <Database className="size-5 text-primary" /> Your data
              </CardTitle>
              <CardDescription>
                {tasks.length} assignments · {notes.length} notes · {classes.length} classes · {subjects.length} subjects
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={exportData}>
                <Download /> Download backup
              </Button>
              <Button variant="outline" onClick={() => setSampleOpen(true)}>
                <Sparkles /> Load example data
              </Button>
              <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setResetOpen(true)}>
                <Trash2 /> Delete all data
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* About */}
        <Card className="h-fit overflow-hidden rounded-2xl shadow-soft">
          <div className="bg-brand p-6 text-white">
            <div className="flex items-center gap-3">
              <LogoMark className="size-12 bg-white/20 shadow-none" />
              <div>
                <h2 className="font-display text-2xl font-extrabold">StudySphere</h2>
                <p className="text-sm text-white/85">Plan Smarter. Study Better.</p>
              </div>
            </div>
          </div>
          <CardContent className="space-y-6 py-6">
            <div>
              <h3 className="font-display font-bold">Why StudySphere?</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                StudySphere brings everything a student needs to stay organised into one calm, focused space.
                Instead of juggling sticky notes, paper planners and separate apps, you can track homework,
                keep subject notes, follow your timetable and build healthy focus habits — all in one place.
              </p>
            </div>
            <ul className="space-y-3">
              {FEATURES.map((f) => (
                <li key={f.title} className="flex gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <f.icon className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{f.title}</p>
                    <p className="text-sm text-muted-foreground">{f.text}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex gap-3 rounded-xl bg-success/10 p-4">
              <ShieldCheck className="size-5 shrink-0 text-emerald-600 dark:text-success" />
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">Private by design.</span> There’s no account and
                nothing is sent to a server — your data is stored only in this browser’s local storage. Use
                “Download backup” to keep a copy.
              </p>
            </div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Version 1.0 · Made with <Heart className="size-3 fill-rose-500 text-rose-500" /> for students
            </p>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Delete all StudySphere data?"
        description="This permanently removes your homework, notes, timetable, subjects, focus history and display name from this browser. Consider downloading a backup first."
        confirmLabel="Delete everything"
        onConfirm={() => {
          store.resetAllData()
          toast.success('All data deleted', { description: 'StudySphere is fresh and ready to go.' })
        }}
      />
      <ConfirmDialog
        open={sampleOpen}
        onOpenChange={setSampleOpen}
        title="Load example data?"
        description="This replaces your current homework, notes, subjects and timetable with example content. Your focus history and settings are kept."
        confirmLabel="Load examples"
        destructive={false}
        onConfirm={() => {
          store.loadSampleData()
          toast.success('Example data loaded')
        }}
      />
    </div>
  )
}
