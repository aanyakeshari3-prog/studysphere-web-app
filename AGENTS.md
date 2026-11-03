# AGENTS.md

Guide for developers and AI agents working on StudySphere.

## Project overview

StudySphere ("Plan Smarter. Study Better.") is a student productivity app: dashboard, homework manager, notes, focus (Pomodoro) timer, weekly timetable, and settings/about. It is a fully client-side app — **all data persists in browser `localStorage`**; there is no backend, no auth, and no external API. Keep it that way unless the product owner asks otherwise.

## Tech stack

TanStack Start (React 19, TanStack Router, file-based routes), Vite 8, Tailwind CSS 4, shadcn/ui (Radix), lucide-react icons, sonner toasts, TypeScript strict. Deployed on Netlify via `@netlify/vite-plugin-tanstack-start` (`netlify.toml`: `vite build` → `dist/client`).

## Architecture

- `src/routes/__root.tsx` — HTML shell. Wraps every page in `StoreProvider` → `TimerProvider` → `TooltipProvider` → `AppShell`. Contains an inline script that applies the saved dark theme before first paint (html has `suppressHydrationWarning`). Loads the Plus Jakarta Sans font.
- `src/components/app-shell.tsx` — layout: collapsible desktop sidebar (state in `prefs.sidebarCollapsed`), mobile top header with a left `Sheet` menu, mobile bottom nav (first five `NAV_ITEMS`), theme toggle, running-timer pill, and the `Toaster`. **It renders a spinner until the store is hydrated**, so page components only ever render on the client with real data — they may safely use `new Date()` / `window` during render.
- `src/lib/store.tsx` — single React context holding tasks, notes, subjects, timetable classes, focus sessions and preferences. Loads from `localStorage` in `useEffect`, then writes back only slices whose reference changed. Each slice has its own key (`STORAGE_KEYS`). All mutations are actions on the context (`addTask`, `toggleTask`, `restoreTask`, `deleteSubject`, …). Add new persisted data here.
- `src/lib/timer.tsx` — focus timer context (25 min focus / 5 min break). Uses a wall-clock `endAt` so it stays accurate when the tab is throttled; keeps running across page navigation; logs completed focus sessions to the store; updates `document.title`; plays a WebAudio chime.
- `src/lib/types.ts`, `dates.ts`, `subjects.ts`, `sample-data.ts` — types, local-date helpers, subject colour classes, and the optional example data.
- `src/routes/*.tsx` — `index` (Dashboard), `homework`, `notes`, `focus`, `timetable`, `settings` (Settings & About).
- `src/components/` — `task-dialog`, `task-item`, `note-dialog`, `class-dialog`, `subjects-dialog`, `confirm-dialog`, `empty-state`, `page-header`, `subject-badge` (badge, dot, `SubjectSelect`), `priority-badge`, `logo`.

## Conventions and non-obvious decisions

- Dates for due dates are local `YYYY-MM-DD` strings (`toDateKey`), compared as strings. Never use `toISOString().slice(0,10)` for "today" (that's UTC).
- Weekdays are Monday-based (`0 = Monday`), see `weekdayIndex`.
- `subjectId === ''` means "General" (no subject); `getSubject` returns `NO_SUBJECT` for unknown ids. Deleting a subject removes its timetable classes and moves its tasks/notes to General.
- Subject colour Tailwind classes are written out in full in `SUBJECT_COLORS` — don't build class names dynamically (Tailwind can't detect them).
- Forms use controlled state with small inline validators and `FieldError`; every create/update/delete shows a sonner toast. Deletes go through `ConfirmDialog` and tasks/notes offer Undo.
- Theme colours live in `src/styles.css` (`:root` and `.dark`), including custom `--success`, `--warning`, and `--brand-gradient` (`bg-brand` utility), plus `shadow-soft`, `shadow-glow`, `animate-fade-up`. Use theme classes rather than raw colours where possible.
- Components PascalCase, hooks/utilities camelCase, route files kebab-case, `@/` import alias.
- `src/routeTree.gen.ts` is generated — don't edit it.

## Commands

```bash
npm run dev        # Vite dev server on :3000
npm run build      # Production build
npm run typecheck  # tsc --noEmit
npm run lint
npm test
```
