'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import ThemeToggle from './ThemeToggle'
import { useReviewCount } from './ReviewCountContext'

export function Nav() {
  const pathname = usePathname() || '/'
  const { count: reviewCount } = useReviewCount()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

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
            href="/tasks"
            className={`nav-link ${pathname === '/tasks' ? 'active' : ''}`}
          >
            Tasks
          </Link>
          <Link
            href="/review"
            className={`nav-link ${pathname === '/review' ? 'active' : ''}`}
          >
            Review
            {mounted && reviewCount > 0 && (
              <span className="nav-badge">{reviewCount}</span>
            )}
          </Link>
        </div>
        <ThemeToggle />
      </div>
    </nav>
  )
}
