'use client'

import { useState, useMemo } from 'react'
import type { Deal } from '@/types/database'
import { formatStageName, getDealDueDateStatus, formatDealDueDate } from '@/lib/dateUtils'
import { STAGE_ORDER } from '@/constants/stages'

interface DealListProps {
  deals: Deal[]
  stages: string[]
  onDealClick?: (deal: Deal) => void
}

type SortKey = 'company' | 'stage' | 'deal_type' | 'next_step' | 'next_step_due'
type SortDir = 'asc' | 'desc'

export function DealList({ deals, stages, onDealClick }: DealListProps) {
  const [selectedStage, setSelectedStage] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('company')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortedDeals = useMemo(() => {
    let filtered = selectedStage
      ? deals.filter(d => d.stage === selectedStage)
      : deals

    return [...filtered].sort((a, b) => {
      let aVal: string | number = ''
      let bVal: string | number = ''

      switch (sortKey) {
        case 'company':
          aVal = (a.company || a.name || '').toLowerCase()
          bVal = (b.company || b.name || '').toLowerCase()
          break
        case 'stage':
          aVal = STAGE_ORDER.indexOf(a.stage || '')
          bVal = STAGE_ORDER.indexOf(b.stage || '')
          if (aVal === -1) aVal = 999
          if (bVal === -1) bVal = 999
          break
        case 'deal_type':
          aVal = (a.deal_type || '').toLowerCase()
          bVal = (b.deal_type || '').toLowerCase()
          break
        case 'next_step':
          aVal = (a.next_step || '').toLowerCase()
          bVal = (b.next_step || '').toLowerCase()
          break
        case 'next_step_due':
          aVal = a.next_step_due ? new Date(a.next_step_due).getTime() : Infinity
          bVal = b.next_step_due ? new Date(b.next_step_due).getTime() : Infinity
          break
      }

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [deals, selectedStage, sortKey, sortDir])

  const SortHeader = ({ column, label }: { column: SortKey; label: string }) => (
    <th
      className={`sortable ${sortKey === column ? 'sorted' : ''}`}
      onClick={() => handleSort(column)}
    >
      <span>{label}</span>
      {sortKey === column && (
        <svg
          className={`sort-icon ${sortDir}`}
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="currentColor"
        >
          <path d="M6 2L10 7H2L6 2Z" />
        </svg>
      )}
    </th>
  )

  return (
    <div className="deal-list">
      <div className="filter-bar">
        <button
          className={`filter-btn ${selectedStage === null ? 'active' : ''}`}
          onClick={() => setSelectedStage(null)}
        >
          All ({deals.length})
        </button>
        {stages.map(stage => {
          const count = deals.filter(d => d.stage === stage).length
          return (
            <button
              key={stage}
              className={`filter-btn ${selectedStage === stage ? 'active' : ''}`}
              onClick={() => setSelectedStage(stage)}
            >
              {formatStageName(stage)} ({count})
            </button>
          )
        })}
      </div>

      <div className="table-container">
        {sortedDeals.length > 0 ? (
          <table className="deals-table">
            <thead>
              <tr>
                <SortHeader column="company" label="Company" />
                <SortHeader column="stage" label="Stage" />
                <SortHeader column="deal_type" label="Deal Type" />
                <SortHeader column="next_step" label="Next Step" />
                <SortHeader column="next_step_due" label="Due Date" />
              </tr>
            </thead>
            <tbody>
              {sortedDeals.map(deal => {
                const dueStatus = getDealDueDateStatus(deal.next_step_due)
                return (
                  <tr
                    key={deal.id}
                    className={`deal-row ${onDealClick ? 'clickable' : ''}`}
                    onClick={() => onDealClick?.(deal)}
                  >
                    <td>
                      <div className="deal-link">
                        <span className="deal-company">{deal.company || deal.name}</span>
                        {deal.company && deal.name !== deal.company && (
                          <span className="deal-name">{deal.name}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`stage-pill ${(deal.stage || '').replace('_', '-')}`}>
                        {formatStageName(deal.stage)}
                      </span>
                    </td>
                    <td className="text-secondary">
                      {deal.deal_type || '—'}
                    </td>
                    <td className="text-secondary">
                      {deal.next_step || '—'}
                    </td>
                    <td>
                      <span className={`due-date ${dueStatus}`}>
                        {formatDealDueDate(deal.next_step_due)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            {selectedStage
              ? `No deals in ${selectedStage} stage`
              : 'No deals found'}
          </div>
        )}
      </div>
    </div>
  )
}
