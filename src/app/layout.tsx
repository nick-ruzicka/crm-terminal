import type { Metadata } from 'next'
import './globals.css'
import { Nav } from '@/components/Nav'
import { CommandPalette } from '@/components/CommandPalette'
import { ToastProvider } from '@/components/Toast'
import { ThemeProvider } from '@/components/ThemeProvider'
import AmbientPlayer from '@/components/AmbientPlayer'

export const metadata: Metadata = {
  title: 'CRM Terminal',
  description: 'Supabase CRM Dashboard',
}

// Script to prevent flash of wrong theme
const themeScript = `
  (function() {
    try {
      var theme = localStorage.getItem('theme');
      if (theme === 'light') {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      } else if (!theme && window.matchMedia('(prefers-color-scheme: light)').matches) {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      }
    } catch (e) {}
  })();
`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeProvider>
          <ToastProvider>
            <Nav />
            <main className="container">
              {children}
            </main>
            <CommandPalette />
            <AmbientPlayer />
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
