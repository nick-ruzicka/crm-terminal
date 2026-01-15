'use client'

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'

interface ReviewCountContextType {
  count: number
  refreshCount: () => Promise<void>
  decrementCount: () => void
}

const ReviewCountContext = createContext<ReviewCountContextType | undefined>(undefined)

export function ReviewCountProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0)

  const refreshCount = useCallback(async () => {
    try {
      const res = await fetch('/api/review/count', { cache: 'no-store' })
      const data = await res.json()
      setCount(data.count || 0)
    } catch {
      console.error('Failed to fetch review count')
    }
  }, [])

  // Optimistic update - immediately decrement count
  const decrementCount = useCallback(() => {
    setCount(prev => Math.max(0, prev - 1))
  }, [])

  // Initial fetch and periodic refresh
  useEffect(() => {
    refreshCount()
    const interval = setInterval(refreshCount, 60000)
    return () => clearInterval(interval)
  }, [refreshCount])

  return (
    <ReviewCountContext.Provider value={{ count, refreshCount, decrementCount }}>
      {children}
    </ReviewCountContext.Provider>
  )
}

export function useReviewCount() {
  const context = useContext(ReviewCountContext)
  if (context === undefined) {
    throw new Error('useReviewCount must be used within a ReviewCountProvider')
  }
  return context
}
