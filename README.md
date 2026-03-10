# ACQ Vantage Community Manager

A full-stack Next.js app for managing community engagement on the ACQ Vantage Skool group. Scrapes posts, classifies them by topic, routes to team members, and generates voice-matched draft replies.

## Quick Start

```bash
# Install dependencies
npm install

# Copy env template and fill in values
cp .env.local.example .env.local

# Run development server
npm run dev
```

## Environment Variables

See `.env.local.example` for all required variables:
- Skool auth credentials
- Anthropic API key
- Vercel Postgres connection strings
- Cron secret

## Database

Initialize the database:
```bash
curl -X POST http://localhost:3000/api/init-db \
  -H "Content-Type: application/json" \
  -d '{"secret": "your-secret"}'
```

## Usage

1. **Scrape**: Click "Scrape Now" or wait for daily cron (9am ET)
2. **Classify**: Click "Classify Untagged" to classify new posts
3. **Browse**: Filter posts by topic, role, replier, or status
4. **Draft**: Click "Generate Draft" on any post to get a voice-matched reply
5. **Reply**: Edit the draft, copy to clipboard, and mark as replied

## Deployment

Deploy to Vercel with a linked Postgres database. The daily scrape cron is configured in `vercel.json`.

## Architecture

See `CLAUDE.md` for detailed architecture documentation, API routes, and Skool API quirks.
