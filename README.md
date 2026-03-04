# Dispatch — AI CRM Terminal

> Built to replace HubSpot for a Series A blockchain startup. One person, one interface, one brain.

**[Read the full build story on Medium →](https://medium.com/@nick.c.ruzicka/built-an-ai-crm-in-18-hours-hubspot-was-moved-to-closed-lost-c78aee3cf63a)**

---

## What It Is

Dispatch is a pipeline management terminal with a natural language interface powered by Claude. Instead of clicking through HubSpot, you talk to your CRM:

```
"Move all deals we haven't talked to in 30 days to Closed Lost."
"What's blocking the Acme partnership?"
"Find every conversation where someone mentioned pricing."
```

It replaced HubSpot at [Linera](https://linera.io) — a Layer 1 blockchain company — where I ran BD as a one-person GTM function. Deals, contacts, meeting notes, and pipeline all flow into one queryable interface.

---

## Why I Built It

HubSpot is built for sales teams. I needed something built for how I actually work:

- **Meeting notes auto-ingest** — Granola transcribes every call, Zapier routes transcripts into the database, Claude extracts deal context and links it automatically
- **Semantic search** — pgvector embeddings mean searching by meaning, not keywords. "What did we discuss about pricing?" works even if nobody said "pricing"
- **One interface** — deals, tasks, notes, and pipeline in a single terminal. No tab switching

The data lives in a Supabase database I own. No vendor lock-in, no $500/month seat fees, no features I don't need.

---

## Architecture

```
Granola (meeting transcription)
    ↓
Zapier (webhook routing)
    ↓
Supabase (PostgreSQL + pgvector)
    ↓
Claude API (context extraction, routing, semantic search)
    ↓
Next.js Terminal UI
```

**Three layers:**
1. **Capture** — meetings auto-sync via Zapier. Pipeline migrated from HubSpot. Everything is stored with vector embeddings for semantic retrieval
2. **Interpretation** — Claude reads each note, links it to existing deals or creates new ones, extracts next steps and action items
3. **Execution** — work from the terminal. Check pipeline, move deals, search past conversations — all through chat

---

## Features

- **Pipeline dashboard** — deal stages, health overview, overdue next steps
- **Deal management** — create, update, and move deals through stages
- **AI chat interface** — natural language queries across all CRM data
- **Semantic search** — find conversations by meaning using pgvector
- **Contact tracking** — linked contacts per deal with role and channel info
- **Meeting notes** — auto-ingested and linked to deals via Zapier webhook

---

## Tech Stack

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Database:** Supabase (PostgreSQL + pgvector for semantic search)
- **AI:** Anthropic Claude API
- **Automation:** Zapier (Granola → Supabase webhook)
- **Deploy:** Vercel

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Database Schema

| Table | Key Fields |
|-------|-----------|
| `deals` | id, name, company, stage, deal_type, source, next_step, next_step_due |
| `contacts` | id, deal_id, name, email, role, telegram, is_primary |
| `notes` | id, deal_id, content, meeting_date, embedding (vector) |

---

## Deploy

1. Push to GitHub
2. Import in [Vercel](https://vercel.com)
3. Add environment variables
4. Deploy

**Live demo:** [crm-terminal-dusky.vercel.app](https://crm-terminal-dusky.vercel.app)

---

## What I'd Build Next

- **Slack weekly digest** — Monday morning pipeline summary pushed to me
- **Calendar integration** — pre-meeting prep: recent news, last conversation, open action items
- **Telegram sync** — most partner conversations happen there; currently a blind spot

---

*Built by [Nick Ruzicka](https://github.com/nick-ruzicka) — GTM Engineer & BD leader. Previously Head of BD at Linera, founding AE at Rivery (acq. Boomi), Oracle.*
