'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Deal } from '@/types/database'

interface DealsTableProps {
  deals: Deal[]
  stages: string[]
}

export function DealsTable({ deals, stages }: DealsTableProps) {
  const [selectedStage, setSelectedStage] = useState<string | null>(null)

  const filteredDeals = selectedStage
    ? deals.filter(d => d.stage === selectedStage)
    : deals

  return (
    <div>
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
              {stage} ({count})
            </button>
          )
        })}
      </div>

      <div className="table-container">
        {filteredDeals.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Company</th>
                <th>Stage</th>
                <th>Type</th>
                <th>Source</th>
                <th>Next Step</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeals.map(deal => (
                <tr key={deal.id} className="clickable-row">
                  <td>
                    <Link href={`/deals/${deal.id}`}>{deal.name}</Link>
                  </td>
                  <td>{deal.company || '—'}</td>
                  <td>
                    <span className={`stage-pill ${(deal.stage || '').toLowerCase()}`}>
                      {deal.stage || 'Unknown'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {deal.deal_type || '—'}
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {deal.source || '—'}
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {deal.next_step || '—'}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                    {deal.next_step_due
                      ? new Date(deal.next_step_due).toLocaleDateString()
                      : '—'}
                  </td>
                </tr>
              ))}
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
