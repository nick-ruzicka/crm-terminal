'use client'

import { ReactNode } from 'react'

interface SkeletonProps {
  className?: string
  width?: string | number
  height?: string | number
}

export function Skeleton({ className = '', width, height }: SkeletonProps) {
  const style: React.CSSProperties = {}
  if (width) style.width = typeof width === 'number' ? `${width}px` : width
  if (height) style.height = typeof height === 'number' ? `${height}px` : height

  return <div className={`skeleton ${className}`} style={style} />
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`skeleton-text ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="skeleton-line"
          width={i === lines - 1 ? '60%' : '100%'}
          height={14}
        />
      ))}
    </div>
  )
}

export function SkeletonAvatar({ size = 40 }: { size?: number }) {
  return <Skeleton className="skeleton-avatar" width={size} height={size} />
}

export function SkeletonCard({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return (
    <div className={`skeleton-card ${className}`}>
      {children || (
        <>
          <div className="skeleton-card-header">
            <SkeletonAvatar />
            <div className="skeleton-card-meta">
              <Skeleton width={120} height={16} />
              <Skeleton width={80} height={12} />
            </div>
          </div>
          <SkeletonText lines={2} />
        </>
      )}
    </div>
  )
}

// Deal Card Skeleton
export function DealCardSkeleton() {
  return (
    <div className="deal-card skeleton-deal-card">
      <div className="deal-card-header">
        <Skeleton width="70%" height={16} />
        <Skeleton width={60} height={20} className="skeleton-badge" />
      </div>
      <div className="deal-card-body">
        <Skeleton width="50%" height={12} />
        <Skeleton width="40%" height={12} />
      </div>
      <div className="deal-card-footer">
        <Skeleton width={80} height={24} />
      </div>
    </div>
  )
}

// Task Card Skeleton
export function TaskCardSkeleton() {
  return (
    <div className="task-card skeleton-task-card">
      <div className="task-card-content">
        <Skeleton width="80%" height={14} />
        <Skeleton width="60%" height={12} />
      </div>
      <div className="task-card-meta">
        <Skeleton width={70} height={20} className="skeleton-badge" />
      </div>
    </div>
  )
}

// Board Column Skeleton
export function BoardColumnSkeleton({ cardCount = 3 }: { cardCount?: number }) {
  return (
    <div className="board-column skeleton-column">
      <div className="board-column-header">
        <Skeleton width={100} height={18} />
        <Skeleton width={24} height={24} className="skeleton-circle" />
      </div>
      <div className="board-column-content">
        {Array.from({ length: cardCount }).map((_, i) => (
          <DealCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

// Table Row Skeleton
export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="skeleton-row">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i}>
          <Skeleton width={i === 0 ? '80%' : '60%'} height={14} />
        </td>
      ))}
    </tr>
  )
}

// Table Skeleton
export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="table-skeleton">
      <table>
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i}>
                <Skeleton width={80} height={12} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRowSkeleton key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Dashboard Stat Card Skeleton
export function StatCardSkeleton() {
  return (
    <div className="stat-card skeleton-stat-card">
      <div className="stat-card-header">
        <Skeleton width={100} height={14} />
        <Skeleton width={32} height={32} className="skeleton-icon" />
      </div>
      <Skeleton width={120} height={32} className="skeleton-value" />
      <div className="stat-card-footer">
        <Skeleton width={60} height={12} />
        <Skeleton width={80} height={12} />
      </div>
    </div>
  )
}

// Chat Message Skeleton
export function ChatMessageSkeleton({ isUser = false }: { isUser?: boolean }) {
  return (
    <div className={`chat-message skeleton-message ${isUser ? 'user' : 'assistant'}`}>
      {!isUser && <SkeletonAvatar size={32} />}
      <div className="message-content">
        <SkeletonText lines={isUser ? 1 : 3} />
      </div>
    </div>
  )
}

// Review Card Skeleton
export function ReviewCardSkeleton() {
  return (
    <div className="review-card skeleton-review-card">
      <div className="review-card-header">
        <SkeletonAvatar size={48} />
        <div className="review-card-info">
          <Skeleton width={150} height={18} />
          <Skeleton width={100} height={14} />
        </div>
        <Skeleton width={80} height={28} className="skeleton-badge" />
      </div>
      <div className="review-card-body">
        <SkeletonText lines={2} />
      </div>
      <div className="review-card-actions">
        <Skeleton width={100} height={36} className="skeleton-button" />
        <Skeleton width={100} height={36} className="skeleton-button" />
      </div>
    </div>
  )
}

// Full Page Loading Skeleton
export function PageSkeleton({ type = 'default' }: { type?: 'default' | 'board' | 'table' | 'dashboard' }) {
  if (type === 'board') {
    return (
      <div className="page-skeleton board-skeleton">
        <div className="page-header-skeleton">
          <Skeleton width={200} height={32} />
          <Skeleton width={120} height={36} className="skeleton-button" />
        </div>
        <div className="board-skeleton-content">
          {Array.from({ length: 5 }).map((_, i) => (
            <BoardColumnSkeleton key={i} cardCount={3 - (i % 2)} />
          ))}
        </div>
      </div>
    )
  }

  if (type === 'table') {
    return (
      <div className="page-skeleton table-page-skeleton">
        <div className="page-header-skeleton">
          <Skeleton width={200} height={32} />
          <div className="header-actions">
            <Skeleton width={200} height={36} className="skeleton-search" />
            <Skeleton width={120} height={36} className="skeleton-button" />
          </div>
        </div>
        <TableSkeleton rows={8} columns={6} />
      </div>
    )
  }

  if (type === 'dashboard') {
    return (
      <div className="page-skeleton dashboard-skeleton">
        <div className="page-header-skeleton">
          <div>
            <Skeleton width={250} height={28} />
            <Skeleton width={180} height={16} />
          </div>
        </div>
        <div className="stats-grid-skeleton">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
        <div className="dashboard-content-skeleton">
          <div className="chart-skeleton">
            <Skeleton width="100%" height={300} />
          </div>
          <div className="activity-skeleton">
            <Skeleton width={150} height={20} />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="activity-item-skeleton">
                <SkeletonAvatar size={32} />
                <div className="activity-content">
                  <Skeleton width="80%" height={14} />
                  <Skeleton width="50%" height={12} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-skeleton default-skeleton">
      <div className="page-header-skeleton">
        <Skeleton width={200} height={32} />
      </div>
      <div className="page-content-skeleton">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  )
}
