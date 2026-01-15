'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'

interface CommandItem {
  id: string
  type: 'page' | 'deal' | 'task' | 'action'
  title: string
  subtitle?: string
  icon: React.ReactNode
  action: () => void
  keywords?: string[]
}

interface CommandPaletteProps {
  deals?: Array<{ id: string; name: string; company?: string; stage: string }>
  tasks?: Array<{ gid: string; name: string; section?: string }>
}

export function CommandPalette({ deals = [], tasks = [] }: CommandPaletteProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Navigation items
  const navigationItems: CommandItem[] = useMemo(() => [
    {
      id: 'nav-dashboard',
      type: 'page',
      title: 'Dashboard',
      subtitle: 'Go to dashboard',
      icon: <HomeIcon />,
      action: () => router.push('/'),
      keywords: ['home', 'overview', 'main'],
    },
    {
      id: 'nav-deals',
      type: 'page',
      title: 'Deals',
      subtitle: 'View all deals',
      icon: <DealsIcon />,
      action: () => router.push('/deals'),
      keywords: ['sales', 'pipeline', 'opportunities'],
    },
    {
      id: 'nav-tasks',
      type: 'page',
      title: 'Tasks',
      subtitle: 'View all tasks',
      icon: <TasksIcon />,
      action: () => router.push('/tasks'),
      keywords: ['asana', 'todo', 'work'],
    },
    {
      id: 'nav-chat',
      type: 'page',
      title: 'Chat',
      subtitle: 'AI Assistant',
      icon: <ChatIcon />,
      action: () => router.push('/chat'),
      keywords: ['ai', 'claude', 'assistant', 'help'],
    },
    {
      id: 'nav-review',
      type: 'page',
      title: 'Review Queue',
      subtitle: 'Review pending items',
      icon: <ReviewIcon />,
      action: () => router.push('/review'),
      keywords: ['approve', 'pending', 'queue'],
    },
  ], [router])

  // Deal items
  const dealItems: CommandItem[] = useMemo(() =>
    deals.map(deal => ({
      id: `deal-${deal.id}`,
      type: 'deal' as const,
      title: deal.name,
      subtitle: deal.company || deal.stage,
      icon: <DealIcon />,
      action: () => router.push(`/deals/${deal.id}`),
      keywords: [deal.company?.toLowerCase() || '', deal.stage.toLowerCase()],
    })),
  [deals, router])

  // Task items
  const taskItems: CommandItem[] = useMemo(() =>
    tasks.map(task => ({
      id: `task-${task.gid}`,
      type: 'task' as const,
      title: task.name,
      subtitle: task.section,
      icon: <TaskIcon />,
      action: () => router.push(`/tasks`),
      keywords: [task.section?.toLowerCase() || ''],
    })),
  [tasks, router])

  // Action items
  const actionItems: CommandItem[] = useMemo(() => [
    {
      id: 'action-new-deal',
      type: 'action',
      title: 'Create New Deal',
      subtitle: 'Add a new deal to pipeline',
      icon: <PlusIcon />,
      action: () => router.push('/deals?new=true'),
      keywords: ['add', 'create', 'new'],
    },
  ], [router])

  // All items combined
  const allItems = useMemo(() => [
    ...navigationItems,
    ...actionItems,
    ...dealItems.slice(0, 10),
    ...taskItems.slice(0, 10),
  ], [navigationItems, actionItems, dealItems, taskItems])

  // Filter items based on query
  const filteredItems = useMemo(() => {
    if (!query.trim()) {
      return allItems.slice(0, 8)
    }

    const lowerQuery = query.toLowerCase()
    return allItems.filter(item => {
      const titleMatch = item.title.toLowerCase().includes(lowerQuery)
      const subtitleMatch = item.subtitle?.toLowerCase().includes(lowerQuery)
      const keywordMatch = item.keywords?.some(k => k.includes(lowerQuery))
      return titleMatch || subtitleMatch || keywordMatch
    }).slice(0, 10)
  }, [query, allItems])

  // Group filtered items by type
  const groupedItems = useMemo(() => {
    const groups: { [key: string]: CommandItem[] } = {
      page: [],
      action: [],
      deal: [],
      task: [],
    }
    filteredItems.forEach(item => {
      groups[item.type].push(item)
    })
    return groups
  }, [filteredItems])

  // Keyboard shortcut to open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(prev => !prev)
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
      setQuery('')
      setSelectedIndex(0)
    }
  }, [isOpen])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, filteredItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && filteredItems[selectedIndex]) {
      e.preventDefault()
      filteredItems[selectedIndex].action()
      setIsOpen(false)
    }
  }, [filteredItems, selectedIndex])

  // Scroll selected item into view
  useEffect(() => {
    const selectedElement = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`)
    selectedElement?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const handleSelect = useCallback((item: CommandItem) => {
    item.action()
    setIsOpen(false)
  }, [])

  if (!isOpen) return null

  return (
    <div className="command-palette-overlay" onClick={() => setIsOpen(false)}>
      <div className="command-palette" onClick={e => e.stopPropagation()}>
        <div className="command-palette-header">
          <SearchIcon />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search pages, deals, tasks..."
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleKeyDown}
            className="command-palette-input"
          />
          <kbd className="command-palette-kbd">ESC</kbd>
        </div>

        <div className="command-palette-content" ref={listRef}>
          {filteredItems.length === 0 ? (
            <div className="command-palette-empty">
              <EmptyIcon />
              <p>No results found</p>
            </div>
          ) : (
            <>
              {groupedItems.page.length > 0 && (
                <div className="command-palette-group">
                  <div className="command-palette-group-label">Pages</div>
                  {groupedItems.page.map((item, idx) => {
                    const globalIndex = filteredItems.indexOf(item)
                    return (
                      <CommandItem
                        key={item.id}
                        item={item}
                        isSelected={selectedIndex === globalIndex}
                        onSelect={handleSelect}
                        dataIndex={globalIndex}
                      />
                    )
                  })}
                </div>
              )}

              {groupedItems.action.length > 0 && (
                <div className="command-palette-group">
                  <div className="command-palette-group-label">Actions</div>
                  {groupedItems.action.map((item) => {
                    const globalIndex = filteredItems.indexOf(item)
                    return (
                      <CommandItem
                        key={item.id}
                        item={item}
                        isSelected={selectedIndex === globalIndex}
                        onSelect={handleSelect}
                        dataIndex={globalIndex}
                      />
                    )
                  })}
                </div>
              )}

              {groupedItems.deal.length > 0 && (
                <div className="command-palette-group">
                  <div className="command-palette-group-label">Deals</div>
                  {groupedItems.deal.map((item) => {
                    const globalIndex = filteredItems.indexOf(item)
                    return (
                      <CommandItem
                        key={item.id}
                        item={item}
                        isSelected={selectedIndex === globalIndex}
                        onSelect={handleSelect}
                        dataIndex={globalIndex}
                      />
                    )
                  })}
                </div>
              )}

              {groupedItems.task.length > 0 && (
                <div className="command-palette-group">
                  <div className="command-palette-group-label">Tasks</div>
                  {groupedItems.task.map((item) => {
                    const globalIndex = filteredItems.indexOf(item)
                    return (
                      <CommandItem
                        key={item.id}
                        item={item}
                        isSelected={selectedIndex === globalIndex}
                        onSelect={handleSelect}
                        dataIndex={globalIndex}
                      />
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <div className="command-palette-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
          <span><kbd>↵</kbd> Select</span>
          <span><kbd>ESC</kbd> Close</span>
        </div>
      </div>
    </div>
  )
}

function CommandItem({
  item,
  isSelected,
  onSelect,
  dataIndex
}: {
  item: CommandItem
  isSelected: boolean
  onSelect: (item: CommandItem) => void
  dataIndex: number
}) {
  return (
    <button
      className={`command-palette-item ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(item)}
      data-index={dataIndex}
    >
      <div className="command-palette-item-icon">{item.icon}</div>
      <div className="command-palette-item-content">
        <span className="command-palette-item-title">{item.title}</span>
        {item.subtitle && (
          <span className="command-palette-item-subtitle">{item.subtitle}</span>
        )}
      </div>
      {isSelected && <ArrowIcon />}
    </button>
  )
}

// Icons
function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="9" r="6" />
      <path d="M13.5 13.5L17 17" />
    </svg>
  )
}

function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 7l7-5 7 5v8a1 1 0 01-1 1H3a1 1 0 01-1-1V7z" />
      <path d="M7 16V9h4v7" />
    </svg>
  )
}

function DealsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M9 1v16M1 9h16" />
      <rect x="3" y="3" width="12" height="12" rx="1" />
    </svg>
  )
}

function TasksIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M6 4h10M6 9h10M6 14h10M2 4h.01M2 9h.01M2 14h.01" />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M16 11a2 2 0 01-2 2H5l-3 3V4a2 2 0 012-2h10a2 2 0 012 2v7z" />
    </svg>
  )
}

function ReviewIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M9 2l2.5 5 5.5.8-4 3.9.9 5.3-4.9-2.6-4.9 2.6.9-5.3-4-3.9 5.5-.8L9 2z" />
    </svg>
  )
}

function DealIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="9" cy="9" r="7" />
      <path d="M9 5v4l3 2" />
    </svg>
  )
}

function TaskIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2" width="14" height="14" rx="2" />
      <path d="M6 9l2 2 4-4" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 4v10M4 9h10" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 3l5 5-5 5" />
    </svg>
  )
}

function EmptyIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5">
      <circle cx="24" cy="24" r="20" />
      <path d="M24 14v10M24 30v4" />
    </svg>
  )
}
