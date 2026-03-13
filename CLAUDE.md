# ACQ Vantage Community Manager

A full-stack Next.js app for the ACQ Vantage team (Saulo, Caio, Victor, Samaria) to manage community engagement on their Skool group (skool.com/acq). It scrapes posts/comments from Skool daily, classifies them by topic and role using the Anthropic API, routes them to the right team member, and generates voice-matched draft replies on demand.

## Tech Stack
- **Framework**: Next.js 14+ (App Router, TypeScript)
- **Styling**: Tailwind CSS (dark theme)
- **Database**: Neon Postgres (via Vercel Postgres SDK)
- **AI**: Anthropic API (claude-sonnet-4-20250514)
- **Deployment**: Vercel (with cron for daily scraping)

## Running Locally

```bash
npm install
npm run dev
```

Create a `.env.local` file (gitignored) with the required variables. See `.env.local.example` for the template.

**Important**: `POSTGRES_URL` must point to the Neon database (not localhost). The connection string format is `postgresql://<user>:<pass>@<host>.neon.tech/neondb?sslmode=require`.

Required environment variables:
- `SKOOL_AUTH_TOKEN` — Skool JWT (expires Jan 2027)
- `SKOOL_CLIENT_ID` — Skool client ID
- `SKOOL_GROUP_ID` — Skool group ID for ACQ
- `ANTHROPIC_API_KEY` — Anthropic API key
- `POSTGRES_URL` — Neon Postgres connection string (not localhost)
- `CRON_SECRET` — Secret for authenticating cron/manual API calls

## Database Setup

Initialize the database by calling:
```
POST /api/init-db  { "secret": "<CRON_SECRET>" }
```
This creates the `posts`, `comments`, `drafts`, and `members` tables with indexes. It's idempotent.

## Architecture

```
Scrape (Skool API) → Classify (Anthropic) → Browse (Dashboard) → Draft (Anthropic)
```

1. **Post Scraper** (`/api/scrape`): Fetches posts and comments from Skool's undocumented API, upserts to Postgres, auto-classifies
2. **Member Scraper** (`/api/scrape-members`): Fetches full member profiles from Skool, upserts to members table
3. **Classifier** (`/api/classify`): Sends unclassified posts to Anthropic in batches of 10, assigns topic + role + repliers
4. **Posts Page** (`/`): Browse, filter, and manage posts with a dark-themed UI
5. **Members Page** (`/members`): View member profiles, engagement scores, segmentation, and activity data
6. **Analytics Dashboard** (`/dashboard`): Charts for posts/week, active users/week, topic trends, seeker response rates, time-to-response
7. **Drafter** (`/api/draft`): Generates voice-matched reply drafts on demand

## API Routes

| Route | Method | Auth | Description |
|---|---|---|---|
| `/api/scrape` | GET | `?secret=` or cookie | Scrape posts + comments from Skool, auto-classify. Params: `pages`, `since` |
| `/api/scrape-members` | GET | `?secret=` or cookie | Scrape all member profiles from Skool |
| `/api/classify` | POST | body/query `secret` or cookie | Classify unclassified posts via Anthropic |
| `/api/draft` | POST | body `secret` or cookie | Generate draft reply for a specific post |
| `/api/posts` | GET | none | List posts with filters. Params: `topic`, `role`, `replier`, `status`, `search`, `dateFrom`, `dateTo`, `author`, `postId`, `authors=1` |
| `/api/posts/status` | PATCH | none | Update post reply status |
| `/api/members` | GET | none | List members with engagement scoring. Params: `sort`, `segment`, `topic`, `search`, `attribution`, `tier`, `joinedFrom`, `joinedTo` |
| `/api/dashboard` | GET | none | Analytics data (posts/week, active users, topic trends, response rates). Params: `range` (30d/90d/all) |
| `/api/stats` | GET | none | Quick dashboard statistics |
| `/api/init-db` | POST | body `secret` | Initialize database tables |

## Prompt Files

All AI prompts live in `/prompts/` and are loaded at runtime by `src/lib/prompts.ts`. These are the source of truth — never hardcode prompt content in code.

- `topic_classification.md` — System prompt for post classification
- `classification_edge_cases.md` — Edge case decision log (appended to classification prompt)
- `reply_drafting.md` — Voice profiles and draft generation rules
- `member_profiling.md` — Member engagement scoring logic
- `draft_replies_format.md` — Display format specs for drafts

## Deployment

- Deploy to Vercel with a linked Postgres database
- `vercel.json` configures two cron jobs:
  - **Daily post scrape**: 2pm UTC (9am ET) → `/api/scrape`
  - **Weekly member scrape**: Sundays 3pm UTC (10am ET) → `/api/scrape-members`
- The `CRON_SECRET` env var must be set in Vercel

## Team Members & Routing

| Topic | Repliers | Voice Profile |
|---|---|---|
| paid_ads | Saulo, Caio | A |
| content_organic | Saulo, Caio | A |
| lead_gen_funnels | Saulo, Victor | A |
| email_outreach | Saulo, Victor | A |
| ai_tools | Victor | A |
| sales_offers | Saulo, Caio, Victor | A |
| tracking_analytics | Victor | A |
| scaling_strategy | Caio | A |
| hiring | Caio | A |
| operations | Caio | A |
| conversational | Samaria | B |

Excluded from analysis: Saulo Castelo Branco, Saulo Medeiros, Caio Beleza, Victor Kim, Samaria Simmons, Alex Hormozi

## Skool API Quirks

- **buildId**: Changes on every Skool deployment. Extract dynamically from homepage HTML via regex.
- **Rate limits**: ~160 comment requests before blocking. Scraper uses 2 concurrent with 600ms delays.
- **Pinned post dedup**: Skool returns pinned posts twice (once as pinned, once in feed). Track seen IDs.
- **Comments endpoint**: Uses `api2.skool.com` (different domain from posts which use `www.skool.com`).
- **Post sorting**: Use `s=newest` for chronological order (NOT `newest-cm`).
- **Comment structure**: Recursive tree — flatten with `flattenComments()` in `src/lib/skool.ts`.
- **Timestamps**: Posts and members may return nanosecond timestamps (>1e15). Use `parseTimestamp()` in `src/lib/skool.ts` to normalize.
- **Members endpoint**: Uses `www.skool.com/_next/data/{buildId}/acq/-/members.json?p={page}`. Paginated, returns all members including profile, subscription, survey, and social data.
- **Member fields**: `metadata` contains bio/location/social links. `member.metadata` contains survey, subscription (`mmbp`), attribution (`attrComp`), `lastOffline`. Survey and subscription are JSON strings that need parsing.
