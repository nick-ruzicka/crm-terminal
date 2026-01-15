import type { Metadata } from 'next'
import './globals.css'
import { Nav } from '@/components/Nav'
import { CommandPalette } from '@/components/CommandPalette'
import { ToastProvider } from '@/components/Toast'

export const metadata: Metadata = {
  title: 'CRM Terminal',
  description: 'Supabase CRM Dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <Nav />
          <main className="container">
            {children}
          </main>
          <CommandPalette />
        </ToastProvider>
      </body>
    </html>
  )
}
