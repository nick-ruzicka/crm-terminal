/**
 * CRM stage, deal type, and source constants
 * Single source of truth for dropdown values and display labels
 */

// Pipeline stages - ordered from beginning to end
export const STAGES = [
  { value: 'lead', label: 'Lead' },
  { value: 'discovery', label: 'Discovery' },
  { value: 'evaluation', label: 'Evaluation' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'closed_won', label: 'Closed Won' },
  { value: 'closed_lost', label: 'Closed Lost' },
] as const

// Stage IDs in order (for sorting)
export const STAGE_ORDER = ['lead', 'discovery', 'evaluation', 'negotiation', 'closed_won', 'closed_lost'] as const

// Stage colors for board view
export const STAGE_COLORS: Record<string, string> = {
  lead: '#6b7280',
  discovery: '#3b82f6',
  evaluation: '#8b5cf6',
  negotiation: '#f59e0b',
  closed_won: '#10b981',
  closed_lost: '#ef4444',
}

// Deal types
export const DEAL_TYPES = [
  { value: 'partnership', label: 'Partnership' },
  { value: 'integration', label: 'Integration' },
  { value: 'investment', label: 'Investment' },
  { value: 'advisory', label: 'Advisory' },
  { value: 'other', label: 'Other' },
] as const

// Lead sources
export const SOURCES = [
  { value: 'inbound', label: 'Inbound' },
  { value: 'outbound', label: 'Outbound' },
  { value: 'referral', label: 'Referral' },
  { value: 'event', label: 'Event' },
  { value: 'other', label: 'Other' },
] as const

// Type helpers
export type Stage = typeof STAGES[number]['value']
export type DealType = typeof DEAL_TYPES[number]['value']
export type Source = typeof SOURCES[number]['value']
