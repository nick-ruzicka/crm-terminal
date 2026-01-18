'use client'

import { useState, useCallback, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import type { Deal } from '@/types/database'
import { getDealDueDateStatus, formatDueDate } from '@/lib/dateUtils'
import { STAGES, STAGE_COLORS } from '@/constants/stages'

// Build STAGES_WITH_COLORS from constants
const STAGES_WITH_COLORS = STAGES.map(s => ({
  id: s.value,
  label: s.label,
  color: STAGE_COLORS[s.value],
}))

interface DealBoardProps {
  initialDeals: Deal[]
  onDealClick?: (deal: Deal) => void
}

interface DealCardProps {
  deal: Deal
  index: number
  onClick?: (deal: Deal) => void
}

function DealCard({ deal, index, onClick }: DealCardProps) {
  const dueStatus = getDealDueDateStatus(deal.next_step_due)

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
  stage: typeof STAGES_WITH_COLORS[0]
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

  // Sync deals when initialDeals prop changes (e.g., from filtering)
  useEffect(() => {
    setDeals(initialDeals)
  }, [initialDeals])

  const dealsByStage = STAGES_WITH_COLORS.reduce((acc, stage) => {
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
          {STAGES_WITH_COLORS.map(stage => (
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
