'use client'

import { useState, useEffect, useCallback } from 'react'
import { ViewToggle, type ViewMode } from './ViewToggle'
import { DealList } from './DealList'
import { DealBoard } from './DealBoard'
import { NewDealModal, DealDetailPanel } from './DealModals'
import type { Deal } from '@/types/database'

interface DealsViewProps {
  deals: Deal[]
  stages: string[]
}

export function DealsView({ deals, stages }: DealsViewProps) {
  const [view, setView] = useState<ViewMode>('list')
  const [mounted, setMounted] = useState(false)
  const [allDeals, setAllDeals] = useState(deals)
  const [showNewDealModal, setShowNewDealModal] = useState(false)
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem('deals-view') as ViewMode | null
    if (stored === 'list' || stored === 'board') {
      setView(stored)
    }
  }, [])

  // Keyboard shortcut: 'n' to open new deal modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'n' && !showNewDealModal && !selectedDeal) {
        e.preventDefault()
        setShowNewDealModal(true)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showNewDealModal, selectedDeal])

  const handleViewChange = (newView: ViewMode) => {
    setView(newView)
    localStorage.setItem('deals-view', newView)
  }

  const handleDealClick = useCallback((deal: Deal) => {
    console.log('Deal clicked:', deal.id, deal.company || deal.name)
    setSelectedDeal(deal)
  }, [])

  const handleDealCreated = useCallback((newDeal: Deal) => {
    setAllDeals(prev => [newDeal, ...prev])
    setShowNewDealModal(false)
  }, [])

  const handleDealUpdate = useCallback((updatedDeal: Deal) => {
    setAllDeals(prev => prev.map(d => d.id === updatedDeal.id ? updatedDeal : d))
    setSelectedDeal(updatedDeal)
  }, [])

  const handleDealDelete = useCallback((dealId: string) => {
    setAllDeals(prev => prev.filter(d => d.id !== dealId))
    setSelectedDeal(null)
  }, [])

  if (!mounted) {
    return (
      <div className="deals-view">
        <div className="view-header">
          <h1>All Deals</h1>
          <ViewToggle storageKey="deals-view" defaultView="list" />
        </div>
        <div className="loading-placeholder">Loading...</div>
      </div>
    )
  }

  return (
    <div className="deals-view">
      <div className="view-header">
        <h1>All Deals</h1>
        <div className="view-header-actions">
          <button className="btn btn-primary" onClick={() => setShowNewDealModal(true)}>
            + New Deal
          </button>
          <ViewToggle storageKey="deals-view" defaultView={view} onChange={handleViewChange} />
        </div>
      </div>
      {view === 'list' ? (
        <DealList deals={allDeals} stages={stages} onDealClick={handleDealClick} />
      ) : (
        <DealBoard initialDeals={allDeals} onDealClick={handleDealClick} />
      )}

      <NewDealModal
        isOpen={showNewDealModal}
        onClose={() => setShowNewDealModal(false)}
        onCreated={handleDealCreated}
      />

      {selectedDeal && (
        <DealDetailPanel
          deal={selectedDeal}
          onClose={() => setSelectedDeal(null)}
          onUpdate={handleDealUpdate}
          onDelete={handleDealDelete}
        />
      )}
    </div>
  )
}
