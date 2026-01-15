'use client'

import { useState, useCallback } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import type { Deal } from '@/types/database'

const STAGES = [
  { id: 'lead', label: 'Lead', color: '#6b7280' },
  { id: 'discovery', label: 'Discovery', color: '#3b82f6' },
  { id: 'evaluation', label: 'Evaluation', color: '#8b5cf6' },
  { id: 'negotiation', label: 'Negotiation', color: '#f59e0b' },
  { id: 'closed_won', label: 'Closed Won', color: '#10b981' },
  { id: 'closed_lost', label: 'Closed Lost', color: '#ef4444' },
]

interface DealBoardProps {
  initialDeals: Deal[]
  onDealClick?: (deal: Deal) => void
}

function getDueDateStatus(dueDate: string | null): 'overdue' | 'soon' | 'normal' {
  if (!dueDate) return 'normal'

  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const diffDays = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return 'overdue'
  if (diffDays <= 3) return 'soon'
  return 'normal'
}

function formatDueDate(dueDate: string | null): string {
  if (!dueDate) return ''
  const date = new Date(dueDate)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow'

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface DealCardProps {
  deal: Deal
  index: number
  onClick?: (deal: Deal) => void
}

function DealCard({ deal, index, onClick }: DealCardProps) {
  const dueStatus = getDueDateStatus(deal.next_step_due)

  return (
    <Draggable draggableId={deal.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`board-card ${snapshot.isDragging ? 'dragging' : ''} ${dueStatus}`}
          onClick={() => onClick?.(deal)}
        >
          <div className="card-header">
            <span className="card-company">{deal.company || deal.name}</span>
            {deal.deal_type && (
              <span className="card-badge">{deal.deal_type}</span>
            )}
          </div>
          {deal.next_step && (
            <div className="card-next-step">{deal.next_step}</div>
          )}
          {deal.next_step_due && (
            <div className={`card-due-date ${dueStatus}`}>
              {formatDueDate(deal.next_step_due)}
            </div>
          )}
        </div>
      )}
    </Draggable>
  )
}

interface StageColumnProps {
  stage: typeof STAGES[0]
  deals: Deal[]
  onDealClick?: (deal: Deal) => void
}

function StageColumn({ stage, deals, onDealClick }: StageColumnProps) {
  return (
    <div className="board-column">
      <div className="column-header" style={{ borderTopColor: stage.color }}>
        <span className="column-title">{stage.label}</span>
        <span className="column-count">{deals.length}</span>
      </div>
      <Droppable droppableId={stage.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`column-content ${snapshot.isDraggingOver ? 'drag-over' : ''}`}
          >
            {deals.map((deal, index) => (
              <DealCard key={deal.id} deal={deal} index={index} onClick={onDealClick} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  )
}

export function DealBoard({ initialDeals, onDealClick }: DealBoardProps) {
  const [deals, setDeals] = useState(initialDeals)
  const [isUpdating, setIsUpdating] = useState(false)

  const dealsByStage = STAGES.reduce((acc, stage) => {
    acc[stage.id] = deals.filter(d => d.stage === stage.id)
    return acc
  }, {} as Record<string, Deal[]>)

  const handleDragEnd = useCallback(async (result: DropResult) => {
    const { destination, source, draggableId } = result

    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return
    }

    const newStage = destination.droppableId
    const dealId = draggableId

    // Optimistic update
    setDeals(prev =>
      prev.map(d => (d.id === dealId ? { ...d, stage: newStage } : d))
    )

    // Update in Supabase
    setIsUpdating(true)
    try {
      const res = await fetch(`/api/deals/${dealId}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      })

      if (!res.ok) {
        // Revert on error
        setDeals(prev =>
          prev.map(d => (d.id === dealId ? { ...d, stage: source.droppableId } : d))
        )
      }
    } catch {
      // Revert on error
      setDeals(prev =>
        prev.map(d => (d.id === dealId ? { ...d, stage: source.droppableId } : d))
      )
    } finally {
      setIsUpdating(false)
    }
  }, [])

  return (
    <div className={`deal-board ${isUpdating ? 'updating' : ''}`}>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="board-columns">
          {STAGES.map(stage => (
            <StageColumn
              key={stage.id}
              stage={stage}
              deals={dealsByStage[stage.id] || []}
              onDealClick={onDealClick}
            />
          ))}
        </div>
      </DragDropContext>
    </div>
  )
}
