import { TaskReminders } from '@/components/workspace/reminders'
import {
  FolderTree,
  FileText,
  Sparkles,
  Layers,
  Star,
  Trash2,
  LogOut,
  Cloud,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { GlobalSearch } from '@/components/workspace/global-search'
import { useState } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import {
  BookOpenText,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sun,
  Timer,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStore } from '@/lib/store'
import { formatClock, useTimer } from '@/lib/timer'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { Logo } from '@/components/logo'

type NavPath =
  | '/'
  | '/homework'
  | '/notes'
  | '/focus'
  | '/timetable'
  | '/settings'
  | '/notebooks'
  | '/documents'
  | '/assistant'
  | '/flashcards'
  | '/calendar'
  | '/favorites'
  | '/trash'

interface NavItem {
  to: NavPath
  label: string
  short: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', short: 'Home', icon: LayoutDashboard },
  {
    to: '/homework',
    label: 'Tasks & Homework',
    short: 'Homework',
    icon: ClipboardList,
  },
  { to: '/notes', label: 'My Notes', short: 'Notes', icon: BookOpenText },
  { to: '/focus', label: 'Focus Timer', short: 'Focus', icon: Timer },
  {
    to: '/timetable',
    label: 'Timetable',
    short: 'Timetable',
    icon: CalendarDays,
  },
  {
    to: '/notebooks',
    label: 'Notebooks',
    short: 'Notebooks',
    icon: FolderTree,
  },
  { to: '/documents', label: 'Documents', short: 'Files', icon: FileText },
  { to: '/assistant', label: 'AI Assistant', short: 'AI', icon: Sparkles },
  { to: '/flashcards', label: 'Flashcards', short: 'Cards', icon: Layers },
  { to: '/calendar', label: 'Calendar', short: 'Calendar', icon: CalendarDays },
  { to: '/favorites', label: 'Favorites', short: 'Favorites', icon: Star },
  { to: '/trash', label: 'Trash', short: 'Trash', icon: Trash2 },
  {
    to: '/settings',
    label: 'Settings & About',
    short: 'Settings',
    icon: Settings,
  },
]

function useIsActive() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  return (to: NavPath) =>
    to === '/' ? pathname === '/' : pathname.startsWith(to)
}

function ThemeToggle({ className }: { className?: string }) {
  const { prefs, updatePrefs } = useStore()
  const dark = prefs.theme === 'dark'
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn('rounded-full', className)}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => updatePrefs({ theme: dark ? 'light' : 'dark' })}
    >
      {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </Button>
  )
}

/** Small pill that shows the running timer from any page. */
function TimerPill({ collapsed = false }: { collapsed?: boolean }) {
  const { status, remaining, mode } = useTimer()
  if (status === 'idle') return null
  return (
    <Link
      to="/focus"
      className={cn(
        'flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary tabular-nums transition-colors hover:bg-primary/15',
        collapsed && 'justify-center px-0',
      )}
      aria-label={`${mode === 'focus' ? 'Focus' : 'Break'} timer: ${formatClock(remaining)} remaining`}
    >
      <span
        className={cn(
          'size-2 rounded-full',
          status === 'running'
            ? 'animate-pulse bg-primary motion-reduce:animate-none'
            : 'bg-muted-foreground',
        )}
      />
      {!collapsed && (
        <>
          {formatClock(remaining)}
          <span className="text-xs font-medium opacity-70">
            {status === 'paused'
              ? 'Paused'
              : mode === 'focus'
                ? 'Focus'
                : 'Break'}
          </span>
        </>
      )}
    </Link>
  )
}

function SidebarLink({
  item,
  collapsed,
  active,
  onNavigate,
}: {
  item: NavItem
  collapsed: boolean
  active: boolean
  onNavigate?: () => void
}) {
  const Icon = item.icon
  const link = (
    <Link
      to={item.to}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors motion-reduce:transition-none',
        active
          ? 'bg-brand text-white shadow-glow'
          : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        collapsed && 'justify-center px-0',
      )}
    >
      <Icon className="size-5 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  )
  if (!collapsed) return link
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  )
}

function SidebarNav({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean
  onNavigate?: () => void
}) {
  const isActive = useIsActive()
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => (
        <SidebarLink
          key={item.to}
          item={item}
          collapsed={collapsed}
          active={isActive(item.to)}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  )
}

function DesktopSidebar() {
  const { prefs, updatePrefs } = useStore()
  const collapsed = prefs.sidebarCollapsed
  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-screen shrink-0 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar p-4 transition-[width] duration-300 motion-reduce:transition-none lg:flex',
        collapsed ? 'w-20' : 'w-64',
      )}
    >
      <div
        className={cn(
          'mb-8 flex items-center',
          collapsed ? 'justify-center' : 'justify-between',
        )}
      >
        <Link to="/" aria-label="StudySphere dashboard">
          <Logo compact={collapsed} />
        </Link>
      </div>
      <SidebarNav collapsed={collapsed} />
      <div className="mt-auto flex flex-col gap-3">
        <TimerPill collapsed={collapsed} />
        {!collapsed && (
          <div className="rounded-2xl bg-accent p-4 text-sm">
            <p className="font-semibold text-accent-foreground">
              Plan Smarter. Study Better.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Your private workspace, saved to the cloud.
            </p>
          </div>
        )}
        <Button
          variant="ghost"
          className={cn(
            'justify-start gap-3 text-muted-foreground',
            collapsed && 'justify-center',
          )}
          onClick={() => updatePrefs({ sidebarCollapsed: !collapsed })}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-5" />
          ) : (
            <>
              <PanelLeftClose className="size-5" />
              Collapse
            </>
          )}
        </Button>
      </div>
    </aside>
  )
}

function MobileHeader({ onOpenMenu }: { onOpenMenu: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex min-h-16 flex-wrap items-center justify-between gap-y-2 border-b bg-background/80 px-4 py-2 backdrop-blur-lg lg:hidden">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenMenu}
          aria-label="Open navigation menu"
        >
          <Menu className="size-5" />
        </Button>
        <Link to="/" aria-label="StudySphere dashboard">
          <Logo />
        </Link>
      </div>
      <div className="flex items-center gap-1">
        <GlobalSearch compact />
        <TimerPill />
        <ThemeToggle />
      </div>
    </header>
  )
}

function MobileBottomNav() {
  const isActive = useIsActive()
  return (
    <nav
      aria-label="Quick navigation"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:hidden"
    >
      {NAV_ITEMS.slice(0, 5).map((item) => {
        const Icon = item.icon
        const active = isActive(item.to)
        return (
          <Link
            key={item.to}
            to={item.to}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
              active ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <span
              className={cn(
                'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                active && 'bg-primary/12',
              )}
            >
              <Icon className="size-5" />
            </span>
            {item.short}
          </Link>
        )
      })}
    </nav>
  )
}

function DesktopTopBar() {
  return (
    <div className="hidden items-center justify-end gap-2 px-8 pt-6 lg:flex">
      <GlobalSearch />
      <TimerPill />
      <ThemeToggle />
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const {
    prefs,
    hydrated,
    syncStatus,
    syncError,
    retrySave,
    recoverDraft,
    discardDraft,
    exportBackup,
    importLegacy,
  } = useStore()
  const { signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-background">
      <TaskReminders />
      <DesktopSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader onOpenMenu={() => setMenuOpen(true)} />
        <DesktopTopBar />
        <main className="mx-auto w-full max-w-content flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-8 lg:pt-2 lg:pb-12">
          <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border bg-card px-3 py-2 text-xs text-muted-foreground">
            <Cloud className="size-3.5" />
            <span role="status">{syncStatus}</span>
            <span className="flex-1" />
            <button className="hover:text-primary" onClick={importLegacy}>
              Import browser data
            </button>
            <button className="hover:text-primary" onClick={exportBackup}>
              Export backup
            </button>
            <button
              className="flex items-center gap-1 hover:text-primary"
              onClick={() => {
                if (
                  syncStatus !== 'Saved to cloud' &&
                  !window.confirm(
                    'Some changes may not be saved. Export a backup before signing out. Continue?',
                  )
                )
                  return
                void signOut()
              }}
            >
              <LogOut className="size-3" /> Sign out
            </button>
          </div>
          {syncError && (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
            >
              {syncError}
              <div className="mt-2 flex gap-3">
                <Button size="sm" onClick={retrySave}>
                  Retry
                </Button>
                <Button size="sm" variant="outline" onClick={discardDraft}>
                  Discard browser draft
                </Button>
                <Button size="sm" variant="outline" onClick={recoverDraft}>
                  Recover browser draft
                </Button>
                <Button size="sm" variant="outline" onClick={exportBackup}>
                  Export recovery backup
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.location.reload()}
                >
                  Reload cloud version
                </Button>
              </div>
            </div>
          )}
          {hydrated ? (
            children
          ) : (
            <div className="flex h-[60vh] items-center justify-center">
              <div className="size-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary motion-reduce:animate-none" />
              <span className="sr-only">Loading your study space…</span>
            </div>
          )}
        </main>
      </div>
      <MobileBottomNav />
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          side="left"
          className="w-72 overflow-y-auto bg-sidebar p-4"
        >
          <SheetHeader className="p-0 pb-6">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SheetDescription className="sr-only">
              Move between StudySphere pages
            </SheetDescription>
            <Logo />
          </SheetHeader>
          <SidebarNav collapsed={false} onNavigate={() => setMenuOpen(false)} />
          <p className="mt-auto rounded-2xl bg-accent p-4 text-xs text-muted-foreground">
            <span className="block text-sm font-semibold text-accent-foreground">
              Plan Smarter. Study Better.
            </span>
            Your study materials stay private to your account.
          </p>
        </SheetContent>
      </Sheet>
      <Toaster
        theme={prefs.theme}
        position="top-right"
        richColors
        closeButton
      />
    </div>
  )
}
