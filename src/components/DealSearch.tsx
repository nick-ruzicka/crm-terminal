'use client'

import { useState, useEffect, useRef } from 'react'

interface Deal {
  id: string
  name: string
  company: string | null
  stage: string | null
}

interface DealSearchProps {
  onSelect: (deal: Deal) => void
  onCancel: () => void
  excludeDealId?: string
}

export function DealSearch({ onSelect, onCancel, excludeDealId }: DealSearchProps) {
  const [deals, setDeals] = useState<Deal[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function fetchDeals() {
      try {
        const res = await fetch('/api/deals')
        const data = await res.json()
        setDeals(data.deals || [])
      } catch (error) {
        console.error('Failed to fetch deals:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchDeals()
  }, [])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const filteredDeals = deals
    .filter(deal => deal.id !== excludeDealId)
    .filter(deal => {
      if (!search) return true
      const searchLower = search.toLowerCase()
      return (
        deal.name?.toLowerCase().includes(searchLower) ||
        deal.company?.toLowerCase().includes(searchLower)
      )
    })

  const formatStage = (stage: string | null) => {
    if (!stage) return 'Unknown'
    return stage.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }

  return (
    <div className="deal-search-overlay" onClick={onCancel}>
      <div className="deal-search-modal" onClick={e => e.stopPropagation()}>
        <div className="deal-search-header">
          <h3>Select a Deal</h3>
          <button className="deal-search-close" onClick={onCancel}>
            &times;
          </button>
        </div>

        <div className="deal-search-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search deals..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="deal-search-input"
          />
        </div>

        <div className="deal-search-results">
          {isLoading ? (
            <div className="deal-search-loading">Loading deals...</div>
          ) : filteredDeals.length === 0 ? (
            <div className="deal-search-empty">
              {search ? 'No deals match your search' : 'No deals found'}
            </div>
          ) : (
            filteredDeals.map(deal => (
              <button
                key={deal.id}
                className="deal-search-item"
                onClick={() => onSelect(deal)}
              >
                <div className="deal-search-item-main">
                  <span className="deal-search-item-company">
                    {deal.company || deal.name}
                  </span>
                  {deal.company && deal.name !== deal.company && (
                    <span className="deal-search-item-name">{deal.name}</span>
                  )}
                </div>
                <span className={`deal-search-item-stage stage-pill ${deal.stage || ''}`}>
                  {formatStage(deal.stage)}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
