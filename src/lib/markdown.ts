// Restore markdown formatting for notes that lost their newlines
export function restoreMarkdownFormatting(content: string): string {
  if (!content) return ''

  // If content already has proper newlines with markdown markers, return as-is
  if (content.includes('\n') && (content.includes('###') || content.includes('\n- '))) {
    return content
  }

  // If content already has multiple newlines, it's probably already formatted
  const newlineCount = (content.match(/\n/g) || []).length
  if (newlineCount > 5) {
    return content
  }

  let formatted = content

  // === STEP 1: Extract and format Granola link ===
  const granolaMatch = formatted.match(/(https:\/\/notes\.granola\.ai\/[dp]\/[a-z0-9-]+)/i)
  let granolaLink = ''
  if (granolaMatch) {
    granolaLink = granolaMatch[1]
    formatted = formatted.replace(/\s*Chat\s+with\s+meeting\s+transcript:?\s*/gi, ' ')
    formatted = formatted.replace(granolaLink, '')
  }

  // === STEP 2: Detect section headers ===
  const sectionHeaders = [
    'Background & Introductions',
    'Background and Introductions',
    'Key Points & Takeaways',
    'Key Points and Takeaways',
    'Action Items & Next Steps',
    'Action Items and Next Steps',
    'Token Sale Structure & Commercial Terms',
    'Token Sale Structure and Commercial Terms',
    'Exchange Listing Strategy & Timeline',
    'Exchange Listing Strategy and Timeline',
    'CoinList Pricing & Structure',
    'Current Partnerships & Progress',
    'Current Partnerships and Progress',
    'Partnerships & Progress',
    'Token Distribution & Incentives',
    'Token Distribution and Incentives',
    'Service Offerings & Capabilities',
    'Service Offerings and Capabilities',
    'BTC Staking Protocol Overview',
    'Staking Protocol Overview',
    'Technical Implementation',
    'Technical Overview',
    'Protocol Overview',
    'Platform Details',
    'Platform Overview',
    'Product Overview',
    'Company Overview',
    'Market Overview',
    'Business Model',
    'Revenue Model',
    'Deal Terms',
    'Next Steps',
    'Action Items',
    'Key Takeaways',
    'Discussion Points',
    'Open Questions',
    'Follow-ups',
    'Team Background',
    'Funding History',
    'Market Opportunity',
    'Competitive Analysis',
    'Risk Factors',
    'Investment Thesis',
    'Token Economics',
    'Tokenomics',
    'Use Cases',
    'Integration Details',
    'Platform Features',
  ]

  sectionHeaders.sort((a, b) => b.length - a.length)
  const headerPlaceholders: string[] = []

  for (const header of sectionHeaders) {
    const escapedHeader = header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(`([\\s;,.]|^)(${escapedHeader})\\s+`, 'gi')

    formatted = formatted.replace(pattern, (match, before, headerText) => {
      const placeholder = `__HEADER_${headerPlaceholders.length}__`
      headerPlaceholders.push(headerText)
      return `\n\n${placeholder}\n\n`
    })
  }

  // === STEP 3: AGGRESSIVE UNIVERSAL FORMATTING ===

  // 3a. Period + Capital = new paragraph
  formatted = formatted.replace(/\. ([A-Z])/g, '.\n\n$1')

  // 3b. Colon + Capital = new line (but protect time patterns like "10:30")
  formatted = formatted.replace(/: ([A-Z])/g, ':\n\n$1')

  // 3c. Parenthetical breaks - ") " followed by capital = new paragraph
  formatted = formatted.replace(/\) ([A-Z])/g, ')\n\n$1')

  // === STEP 4: Numbered/Level patterns = bold on new line ===
  formatted = formatted.replace(/\s(Level \d+:)/gi, '\n\n**$1**')
  formatted = formatted.replace(/\s(Step \d+:)/gi, '\n\n**$1**')
  formatted = formatted.replace(/\s(Phase \d+:)/gi, '\n\n**$1**')
  formatted = formatted.replace(/\s(Stage \d+:)/gi, '\n\n**$1**')
  formatted = formatted.replace(/\s(Option \d+:)/gi, '\n\n**$1**')
  formatted = formatted.replace(/\s(Part \d+:)/gi, '\n\n**$1**')

  // === STEP 5: Dash items = bullets ===
  formatted = formatted.replace(/ - ([A-Z])/g, '\n- $1')
  formatted = formatted.replace(/ - ([a-z])/g, '\n- $1')

  // === STEP 6: Name + colon (action items) = bold on new line ===
  // Common first names that might appear in meeting notes
  const names = ['Nick', 'Ken', 'Andrew', 'David', 'Michael', 'Sarah', 'John', 'James',
    'Robert', 'Chris', 'Matt', 'Dan', 'Tom', 'Steve', 'Mark', 'Paul', 'Brian', 'Jason',
    'Jeff', 'Eric', 'Kevin', 'Ryan', 'Alex', 'Sam', 'Ben', 'Tim', 'Adam', 'Scott',
    'Taishi', 'Wei', 'Li', 'Chen', 'Wang', 'Zhang', 'Liu', 'Huang', 'Yang', 'Zhao']

  for (const name of names) {
    const pattern = new RegExp(`\\s(${name}:)\\s*`, 'g')
    formatted = formatted.replace(pattern, `\n\n**$1** `)
  }

  // Also catch other name-like patterns: Capitalized word (3-15 chars) followed by colon and capital
  formatted = formatted.replace(/\s([A-Z][a-z]{2,14}): ([A-Z])/g, '\n\n**$1:** $2')

  // === STEP 7: Restore header placeholders ===
  for (let i = 0; i < headerPlaceholders.length; i++) {
    formatted = formatted.replace(`__HEADER_${i}__`, `### ${headerPlaceholders[i]}`)
  }

  // === STEP 8: Add Granola link at top if present ===
  if (granolaLink) {
    formatted = `📋 [**View original notes in Granola**](${granolaLink})\n\n---\n\n${formatted}`
  }

  // === STEP 9: Clean up ===
  formatted = formatted.replace(/\n{3,}/g, '\n\n')
  formatted = formatted.replace(/^\n+/, '')
  formatted = formatted.replace(/  +/g, ' ')
  formatted = formatted.replace(/\n-\s*\n/g, '\n')
  // Clean up any double colons from the formatting
  formatted = formatted.replace(/:\n\n\*\*/g, ':\n\n**')

  return formatted.trim()
}
