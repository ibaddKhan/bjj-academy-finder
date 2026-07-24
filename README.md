# BJJ Academy Scraper Platform

A multi-team Next.js 14 platform that automates BJJ gym research. Supports two job types:

1. **Person Finder** — reads competitor names from a Google Sheet, finds their current gym via AI agent (Instagram → Facebook → Smoothcomp waterfall), writes results back in real-time
2. **Gym Enrichment** — reads gym names + locations from a source sheet, runs a 2-stage AI pipeline to extract structured data (website, email, phone, owners, coaches, social media), writes to a destination sheet and to the `event_enrichments` database table

## Stack

- **Next.js 14** (App Router, TypeScript)
- **Username/password auth** — bcrypt + JWT (access token 15 min, refresh token 7 days)
- **Multi-team model** — users belong to teams; per-team Google service accounts and API keys
- **BullMQ + Redis** — background job queue, concurrency 3
- **Prisma + PostgreSQL** — jobs, rows, team settings, enrichment results
- **Google Sheets API** — via per-team service account (not user OAuth)
- **OpenRouter REST API** — AI calls for both pipelines
- **SSE** — real-time job progress streaming via in-process EventEmitter
- **Tailwind CSS + shadcn/ui** — dark mode default

## Features

- **Two job types** — Person Finder and Gym Enrichment with separate creation wizards
- **Gym Enrichment deduplication** — skips gyms already in `event_enrichments` (matched by `name_id`), marks them done automatically
- **Gym Enrichment DB write** — on success, upserts structured result into `event_enrichments` (name, email, phone, address/city/state/country, website, Facebook, Instagram, owners, coaches, owner Instagram)
- **Template system** — extensible pipeline registry for adding new enrichment types
- **Live job progress** — per-row tool log, elapsed timer, stop/resume/delete
- **Retry logic** — up to 5 attempts per row, 5s delay
- **Encrypted API key storage** — AES-256-CBC per team in `TeamSettings`
- **Super-admin panel** — create/manage teams, users, and team membership
- **Team selector** — switch active team from the navbar

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/          # login, logout, refresh, me, switch-team
│   │   ├── admin/         # teams + users CRUD (super_admin only)
│   │   ├── jobs/          # CRUD + stream + stop/resume/retry/delete
│   │   ├── teams/         # user's team list
│   │   ├── settings/      # team API key save/load
│   │   └── sheets/        # tab list + header fetch
│   ├── admin/             # super-admin UI (teams, users)
│   ├── enrichment/new/    # Gym Enrichment job wizard
│   ├── jobs/
│   │   ├── new/           # Person Finder job creation
│   │   └── [id]/          # Job detail + live progress
│   ├── settings/          # API keys + service account
│   └── login/
├── components/
│   ├── JobProgressView.tsx
│   ├── ColumnMapper.tsx           # Person Finder column mapping
│   ├── TemplateColumnMapper.tsx   # Gym Enrichment column mapping
│   ├── SheetConnector.tsx
│   ├── DestinationSheetConnector.tsx
│   ├── TeamSelector.tsx
│   ├── RowLogCard.tsx
│   └── SettingsForm.tsx
├── lib/
│   ├── auth/
│   │   ├── jwt.ts         # sign/verify access tokens, refresh token gen
│   │   ├── password.ts    # bcrypt hash/verify
│   │   └── middleware.ts  # getServerAuthUser(), getAuthUser(req)
│   ├── agent/
│   │   ├── index.ts       # Person Finder AI waterfall loop
│   │   └── tools/         # serper, instagram, facebook, smoothcomp
│   ├── templates/
│   │   ├── registry.ts    # registerTemplate / getTemplate
│   │   └── gym-enrichment/
│   │       ├── index.ts   # 2-stage pipeline
│   │       ├── prompts.ts # Stage 1 + Stage 2 AI prompts
│   │       ├── schema.ts  # result types + parsers
│   │       └── tools/     # scrapingant, facebook-url, smoothcomp-gym
│   ├── events.ts          # In-process EventEmitter for SSE
│   ├── encrypt.ts         # AES-256-CBC
│   ├── queue.ts           # BullMQ queue definition
│   └── sheets.ts          # Google Sheets read/write (service account)
└── workers/
    └── processor.ts       # BullMQ worker — dispatches Person Finder or template

prisma/
├── schema.prisma          # User, Team, Job, JobRow, TeamSettings, EventEnrichment
└── seed.ts                # Creates initial super-admin
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.local.example` to `.env.local`:

```env
DATABASE_URL="postgresql://user:password@host:5432/dbname"
REDIS_URL="redis://default:password@host:6379"
JWT_SECRET="64-char-random-string"        # openssl rand -hex 32
ENCRYPTION_KEY="64-char-hex-string"       # openssl rand -hex 32
APP_URL="http://localhost:3000"

# Initial super-admin (for seed script)
SUPER_ADMIN_USERNAME="admin"
SUPER_ADMIN_PASSWORD="change-me"
SUPER_ADMIN_NAME="Super Admin"
```

### 3. Apply schema and seed

```bash
npm run db:push    # create/update tables
npm run db:seed    # create initial super-admin
```

### 4. Run the dev server

```bash
npm run dev
```

### 5. First-time setup (as super-admin)

1. Log in at `/login` with your seeded credentials
2. Go to `/admin/teams` → create a team
3. Go to `/admin/users` → create users and assign to the team
4. Log in as a team member → go to **Settings**
5. Upload a Google service account JSON key
6. Add API keys: OpenRouter, Serper, RapidAPI (Facebook/Instagram), ZenRows, ScrapingAnt

## Google Service Account Setup

Each team needs a Google service account with Sheets API access:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project → enable **Google Sheets API**
3. Create a **Service Account** → generate a JSON key
4. Upload the JSON key in the team Settings page
5. Share your Google Sheets with the service account email (shown in Settings after upload)

## API Keys (configured per team in Settings)

| Key | Used for |
|-----|----------|
| OpenRouter | AI calls for Person Finder and Gym Enrichment |
| Serper | Google Search (both pipelines) |
| RapidAPI (instagram-looter2) | Instagram profile scraping (Person Finder) |
| RapidAPI (facebook-scraper3) | Facebook profile scraping (both pipelines) |
| ZenRows | Smoothcomp scraping |
| ScrapingAnt | Website scraping (Gym Enrichment) |

## Scripts

```bash
npm run dev          # Start dev server (worker runs in-process)
npm run build        # prisma generate + next build
npm run start        # db push + next start (production)
npm run db:push      # Apply schema to DB
npm run db:seed      # Seed super-admin
npm run db:studio    # Open Prisma Studio
```

## Deployment (Railway)

1. Add **PostgreSQL** and **Redis** as Railway plugins
2. Set all environment variables in Railway project settings
3. Set build command: `npm run build`
4. Set start command: `npm run start` (runs `prisma db push` automatically)
5. Run `npm run db:seed` once after first deploy to create the super-admin

## Architecture Notes

- Worker starts in the same Next.js process via `src/app/layout.tsx` (singleton on `globalThis`). SSE is in-process — single instance only (use Redis pub/sub to scale horizontally).
- Gym Enrichment: source sheet rows get `status/aiOwner/aiCoach` written back; destination sheet gets a new appended row per gym; `event_enrichments` table gets upserted.
- All API keys are AES-256-CBC encrypted before storing in `TeamSettings`.
- Row retry: up to 5 attempts, 5s delay, tracked in `JobRow.attempts`.
