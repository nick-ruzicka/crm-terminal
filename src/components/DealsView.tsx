'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { ViewToggle, type ViewMode } from './ViewToggle'
import { DealList } from './DealList'
import { DealBoard } from './DealBoard'
import { NewDealModal, DealDetailPanel } from './DealModals'
import { STAGES } from '@/constants/stages'
import type { Deal } from '@/types/database'

// Demo company names for filtering
const DEMO_COMPANIES = [
  'Hooli', 'Pied Piper', 'Initech', 'Vandelay Industries', 'Stark Industries',
  'Wayne Enterprises', 'Acme Corp', 'Globex', 'Dunder Mifflin', 'Prestige Worldwide',
  'Umbrella Corp', 'Bluth Company', 'Wonka Industries', 'Cyberdyne', 'Skynet',
  'Weyland-Yutani', 'Tyrell Corp', 'Oscorp', 'LexCorp', 'Gekko & Co',
  'Nakatomi Trading', 'Genco Olive Oil', 'Sterling Cooper', 'Pearson Hardman',
  'Wolfram & Hart', 'InGen', 'Soylent Corp', 'Omni Consumer Products', 'Rekall',
  'Virtucon', 'Massive Dynamic', 'Bada Bing Entertainment', "Satriale's Pork Store",
  'Nuovo Vesuvio Holdings', 'Barone Sanitation', 'Webistics'
]

interface DealsViewProps {
  deals: Deal[]
  stages: string[]
}

const FILTER_STAGES = [
  { value: 'all', label: 'All' },
  ...STAGES.filter(s => !s.value.startsWith('closed_'))
]

export function DealsView({ deals, stages }: DealsViewProps) {
  const [view, setView] = useState<ViewMode>('list')
  const [mounted, setMounted] = useState(false)
  const [allDeals, setAllDeals] = useState(deals)
  const [showNewDealModal, setShowNewDealModal] = useState(false)
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [demoMode, setDemoMode] = useState(false)

  // Filter deals based on search, stage, and demo mode
  const filteredDeals = useMemo(() => {
    return allDeals.filter(deal => {
      // Demo mode filter
      if (demoMode) {
        const isDemo = DEMO_COMPANIES.some(demo =>
          (deal.company || '').toLowerCase() === demo.toLowerCase()
        )
        if (!isDemo) return false
      }

      // Search filter
      const matchesSearch = searchQuery === '' ||
        (deal.company || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (deal.name || '').toLowerCase().includes(searchQuery.toLowerCase())

      // Stage filter
      const matchesStage = stageFilter === 'all' || deal.stage === stageFilter

      return matchesSearch && matchesStage
    })
  }, [allDeals, searchQuery, stageFilter, demoMode])

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem('deals-view') as ViewMode | null
    if (stored === 'list' || stored === 'board') {
      setView(stored)
    }
    const storedDemoMode = localStorage.getItem('deals-demo-mode')
    if (storedDemoMode === 'true') {
      setDemoMode(true)
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

      {/* Search and Filter Bar */}
      <div className="deals-filter-bar">
        <input
          type="text"
          placeholder="Search deals..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="deals-search-input"
        />
        <label className="demo-mode-toggle">
          <input
            type="checkbox"
            checked={demoMode}
            onChange={(e) => {
              setDemoMode(e.target.checked)
              localStorage.setItem('deals-demo-mode', e.target.checked.toString())
            }}
          />
          <span>Demo Mode</span>
        </label>
        <div className="stage-filter-pills">
          {FILTER_STAGES.map(stage => (
            <button
              key={stage.value}
              className={`stage-filter-pill ${stageFilter === stage.value ? 'active' : ''}`}
              onClick={() => setStageFilter(stage.value)}
            >
              {stage.label}
            </button>
          ))}
        </div>
      </div>

      {view === 'list' ? (
        <DealList deals={filteredDeals} stages={stages} onDealClick={handleDealClick} />
      ) : (
        <DealBoard initialDeals={filteredDeals} onDealClick={handleDealClick} />
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
