import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

import { TooltipProvider } from '@/components/ui/tooltip'
import { NotFoundPage } from '@/components/error-pages'
import { AppShell } from '@/components/app-shell'
import { AuthGate } from '@/lib/auth'
import { StoreProvider } from '@/lib/store'
import { TimerProvider } from '@/lib/timer'

import '../styles.css'

const siteName = 'StudySphere — Plan Smarter. Study Better.'
const siteDescription =
  'StudySphere is a free student productivity app: homework planner, notes, focus timer and weekly timetable in one place.'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: siteName,
      },
      {
        name: 'description',
        content: siteDescription,
      },
      {
        property: 'og:title',
        content: siteName,
      },
      {
        property: 'og:description',
        content: siteDescription,
      },
      {
        property: 'og:type',
        content: 'website',
      },
      {
        name: 'twitter:card',
        content: 'summary_large_image',
      },
      {
        name: 'theme-color',
        content: '#5b4be0',
      },
    ],
    links: [
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap',
      },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFoundPage,
})

// Applies the saved theme before first paint so dark mode doesn't flash.
const themeScript = `try{var p=JSON.parse(localStorage.getItem('studysphere.preferences')||'{}');if(p.theme==='dark')document.documentElement.classList.add('dark')}catch(e){}`

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <HeadContent />
      </head>
      <body>
        <AuthGate>
          <StoreProvider>
            <TimerProvider>
              <TooltipProvider>
                <AppShell>{children}</AppShell>
              </TooltipProvider>
            </TimerProvider>
          </StoreProvider>
        </AuthGate>
        <Scripts />
      </body>
    </html>
  )
}
