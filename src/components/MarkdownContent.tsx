'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { restoreMarkdownFormatting } from '@/lib/markdown'

interface MarkdownContentProps {
  content: string
  compact?: boolean
}

export function MarkdownContent({ content, compact = false }: MarkdownContentProps) {
  return (
    <div className={`markdown-content${compact ? ' compact' : ''}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {restoreMarkdownFormatting(content)}
      </ReactMarkdown>
    </div>
  )
}
