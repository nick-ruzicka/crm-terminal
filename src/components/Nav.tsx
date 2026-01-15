'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import ThemeToggle from './ThemeToggle'

export function Nav() {
  const pathname = usePathname() || '/'
  const [reviewCount, setReviewCount] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    async function fetchCount() {
      try {
        const res = await fetch('/api/review/count')
        const data = await res.json()
        setReviewCount(data.count || 0)
      } catch {
        console.error('Failed to fetch review count')
      }
    }
    fetchCount()
    // Refresh count every 60 seconds
    const interval = setInterval(fetchCount, 60000)
    return () => clearInterval(interval)
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
          <Link
            href="/chat"
            className={`nav-link ${pathname === '/chat' ? 'active' : ''}`}
          >
            Chat
          </Link>
        </div>
        <ThemeToggle />
      </div>
    </nav>
  )
}
