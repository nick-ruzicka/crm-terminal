# Dispatch CRM Terminal

A Next.js app for managing deals, contacts, and notes from Supabase with an AI-powered chat interface.

## Features

- **Dashboard** - Pipeline stats showing total deals and breakdown by stage
- **Deals List** - Table view with filtering by stage
- **Deal Details** - View deal info with related contacts and notes
- **AI Chat** - Query your CRM data using natural language (powered by Claude)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example env file and fill in your keys:

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

### 3. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deploy to Vercel

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ANTHROPIC_API_KEY`
4. Deploy

## Database Schema

### deals
- `id` - UUID
- `name` - Deal name
- `company` - Company name
- `stage` - Pipeline stage (Lead, Qualified, Proposal, Negotiation, Closed, Lost)
- `deal_type` - Type of deal
- `source` - Lead source
- `next_step` - Next action item
- `next_step_due` - Due date for next step
- `hubspot_id` - HubSpot integration ID

### contacts
- `id` - UUID
- `deal_id` - Foreign key to deals
- `name` - Contact name
- `email` - Email address
- `role` - Job role
- `telegram` - Telegram handle
- `is_primary` - Primary contact flag

### notes
- `id` - UUID
- `deal_id` - Foreign key to deals
- `content` - Note content
- `meeting_date` - Associated meeting date

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Supabase
- Anthropic Claude API
