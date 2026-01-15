'use client'

import { useState, useEffect } from 'react'

export type ViewMode = 'list' | 'board'

interface ViewToggleProps {
  storageKey: string
  defaultView?: ViewMode
  onChange?: (view: ViewMode) => void
}

export function ViewToggle({ storageKey, defaultView = 'list', onChange }: ViewToggleProps) {
  const [view, setView] = useState<ViewMode>(defaultView)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem(storageKey) as ViewMode | null
    if (stored === 'list' || stored === 'board') {
      setView(stored)
      onChange?.(stored)
    }
  }, [storageKey, onChange])

  const handleChange = (newView: ViewMode) => {
    setView(newView)
    localStorage.setItem(storageKey, newView)
    onChange?.(newView)
  }

  if (!mounted) {
    return (
      <div className="view-toggle">
        <button className={`toggle-btn ${defaultView === 'list' ? 'active' : ''}`}>
          List
        </button>
        <button className={`toggle-btn ${defaultView === 'board' ? 'active' : ''}`}>
          Board
        </button>
      </div>
    )
  }

  return (
    <div className="view-toggle">
      <button
        className={`toggle-btn ${view === 'list' ? 'active' : ''}`}
        onClick={() => handleChange('list')}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <rect x="1" y="2" width="12" height="2" rx="0.5" />
          <rect x="1" y="6" width="12" height="2" rx="0.5" />
          <rect x="1" y="10" width="12" height="2" rx="0.5" />
        </svg>
        List
      </button>
      <button
        className={`toggle-btn ${view === 'board' ? 'active' : ''}`}
        onClick={() => handleChange('board')}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <rect x="1" y="1" width="3" height="12" rx="0.5" />
          <rect x="5.5" y="1" width="3" height="8" rx="0.5" />
          <rect x="10" y="1" width="3" height="10" rx="0.5" />
        </svg>
        Board
      </button>
    </div>
  )
}

export function useViewMode(storageKey: string, defaultView: ViewMode = 'list'): [ViewMode, (v: ViewMode) => void] {
  const [view, setView] = useState<ViewMode>(defaultView)

  useEffect(() => {
    const stored = localStorage.getItem(storageKey) as ViewMode | null
    if (stored === 'list' || stored === 'board') {
      setView(stored)
    }
  }, [storageKey])

  const setViewAndStore = (newView: ViewMode) => {
    setView(newView)
    localStorage.setItem(storageKey, newView)
  }

  return [view, setViewAndStore]
}
