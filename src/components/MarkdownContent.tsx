'use client'

import ReactMarkdown from 'react-markdown'
import { restoreMarkdownFormatting } from '@/lib/markdown'

interface MarkdownContentProps {
  content: string
  compact?: boolean
}

export function MarkdownContent({ content, compact = false }: MarkdownContentProps) {
  return (
    <div className={`markdown-content${compact ? ' compact' : ''}`}>
      <ReactMarkdown>{restoreMarkdownFormatting(content)}</ReactMarkdown>
    </div>
  )
}
