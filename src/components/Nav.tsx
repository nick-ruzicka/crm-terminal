'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function Nav() {
  const pathname = usePathname()

  return (
    <nav className="nav">
      <div className="container nav-content">
        <Link href="/" className="nav-logo">
          CRM Terminal
        </Link>
        <div className="nav-links">
          <Link
            href="/"
            className={`nav-link ${pathname === '/' ? 'active' : ''}`}
          >
            Dashboard
          </Link>
          <Link
            href="/deals"
            className={`nav-link ${pathname.startsWith('/deals') ? 'active' : ''}`}
          >
            Deals
          </Link>
          <Link
            href="/chat"
            className={`nav-link ${pathname === '/chat' ? 'active' : ''}`}
          >
            Chat
          </Link>
        </div>
      </div>
    </nav>
  )
}
