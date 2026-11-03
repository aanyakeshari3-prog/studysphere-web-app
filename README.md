# StudySphere

**Plan Smarter. Study Better.**

StudySphere is a free, all-in-one productivity web app for students. It brings your homework, notes, focus sessions and weekly timetable together in one clean dashboard that works on laptops, tablets and phones — in light or dark mode.

There is no sign-up and no server: everything you add is saved privately in your browser's `localStorage`.

## Features

| Page | What you can do |
| --- | --- |
| **Dashboard** | Personal greeting, today's date, homework stats, notes count, today's priorities, upcoming homework, today's classes and study-progress charts. |
| **Homework** | Add, edit, delete and complete assignments with a title, subject, due date, priority and details. Filter by subject, status and priority, search, sort, and spot overdue work highlighted in red. Undo accidental deletes. |
| **Notes** | Create, edit, pin, search and delete notes, organised by colour-coded subject. |
| **Focus Timer** | A 25-minute Pomodoro timer with start, pause, resume, reset and a 5-minute short break. It keeps running while you switch pages, shows the countdown in the browser tab and plays a chime when time is up. Completed sessions count towards a daily goal. |
| **Timetable** | Add classes with subject, day, start/end time and room. Today is highlighted, the class happening right now is marked "Now", and overlapping classes are prevented. Manage your subjects and their colours. |
| **Settings & About** | Edit your display name, switch light/dark mode, collapse the sidebar, set a daily focus goal, download a backup, load example data, delete all data, and read about the app. |

## Tech stack

- [React 19](https://react.dev) with [TanStack Start](https://tanstack.com/start) and file-based routing
- [Tailwind CSS 4](https://tailwindcss.com) for styling, with theme colours in `src/styles.css`
- [shadcn/ui](https://ui.shadcn.com) components (built on Radix UI)
- [lucide-react](https://lucide.dev) icons and [sonner](https://sonner.emilkowal.ski) toast messages
- TypeScript
- Deployed on [Netlify](https://netlify.com)

No paid APIs, API keys or external services are used.

## Run it on your computer

You need [Node.js](https://nodejs.org) version 22.13 or newer.

```bash
# 1. Install the dependencies (only needed once)
npm install

# 2. Start the development server
npm run dev
```

Then open <http://localhost:3000> in your browser. Changes you make to the code reload automatically.

Other useful commands:

```bash
npm run build      # Create a production build in dist/
npm run preview    # Preview the production build locally
npm run typecheck  # Check TypeScript types
npm run lint       # Check code style
npm test           # Run the tests
```

## Deploying to Netlify

The project is already configured in `netlify.toml` (build command `vite build`, publish directory `dist/client`). Connect the repository to Netlify, or run `netlify deploy`, and it builds and deploys automatically.

## Where is my data stored?

All data lives in your browser under these `localStorage` keys:

| Key | Contents |
| --- | --- |
| `studysphere.tasks` | Homework assignments |
| `studysphere.notes` | Notes |
| `studysphere.subjects` | Subjects and their colours |
| `studysphere.timetable` | Timetable classes |
| `studysphere.focusSessions` | Completed focus sessions |
| `studysphere.preferences` | Display name, theme, sidebar and goal settings |

Because the data is stored per browser, it does not sync between devices. Use **Settings → Download backup** to save a copy.

## Project structure

```
src/
├── routes/          # One file per page (index = Dashboard, homework, notes, focus, timetable, settings)
├── components/      # App shell, dialogs, task/note/subject widgets
│   └── ui/          # shadcn/ui base components
├── lib/
│   ├── store.tsx    # App state + localStorage persistence (React context)
│   ├── timer.tsx    # Focus timer state shared across pages
│   ├── types.ts     # Data types
│   ├── dates.ts     # Date helpers
│   ├── subjects.ts  # Subject colours and defaults
│   └── sample-data.ts # Example content
└── styles.css       # Theme colours for light and dark mode
```
