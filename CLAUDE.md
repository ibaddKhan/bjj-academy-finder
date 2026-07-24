# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Start dev server (includes BullMQ worker)
npm run build            # prisma generate + next build
npm run start            # prisma db push + next start (production)
npm run lint             # ESLint
npm run db:push          # Apply Prisma schema to PostgreSQL
npm run db:seed          # Seed initial super-admin (uses SUPER_ADMIN_* env vars)
npm run db:studio        # Open Prisma Studio GUI
```

## Architecture

Multi-team BJJ scraping platform built on Next.js 14. Supports two job types:

1. **Person Finder** (`/jobs/new`) — AI agent finds current gym for a BJJ competitor name
2. **Gym Enrichment** (`/enrichment/new`) — 2-stage AI pipeline: discovers gym links → scrapes → extracts structured data

### Auth System

- Username/password auth (bcrypt 12 rounds + JWT HS256)
- Access token (15 min, httpOnly cookie `access_token`)
- Refresh token (7 days, httpOnly cookie `refresh_token`, stored in `RefreshToken` DB table)
- Non-httpOnly `user_info` cookie for client-side display (name, role, teamId)
- `middleware.ts` protects all routes; expired access tokens trigger redirect to `/api/auth/refresh?redirect=<path>`
- Key files: `src/lib/auth/jwt.ts`, `src/lib/auth/password.ts`, `src/lib/auth/middleware.ts`
- `getServerAuthUser()` — for server components (uses `next/headers`)
- `getAuthUser(req)` — for API route handlers (reads from NextRequest)

### Multi-Team Model

- Users belong to one or more `Team`s via `TeamMember`
- JWT carries `teamId` (active team); switch via `/api/auth/switch-team`
- All API keys and Google service account stored encrypted in `TeamSettings` (AES-256-CBC)
- Super-admin (`role: super_admin`) sees all teams/jobs; members see only their team

### Google Sheets Integration

- Per-team Google service account (JSON key uploaded via Settings page, encrypted at rest)
- `src/lib/sheets.ts` — `getSheetTabs()`, `getSheetHeaders()`, `getUnprocessedRows()`, `writeRowResult()`, `appendRow()`
- All functions take `teamId` as first param; service account fetched from `TeamSettings`

### Core Job Flow

1. User creates job → `POST /api/jobs` → `Job` record created, enqueued in BullMQ
2. Worker picks up → fetches rows from Google Sheets → creates `JobRow` records
3. Per row: either Person Finder agent OR template pipeline runs
4. Results streamed to UI via SSE (in-process EventEmitter, `src/lib/events.ts`)

### Person Finder Agent (`src/lib/agent/index.ts`)

Waterfall with early exit: Instagram → Facebook → Smoothcomp. Writes results back to source sheet.

### Template System (`src/lib/templates/`)

- `registry.ts` — `registerTemplate()`, `getTemplate()`, `listTemplates()`, auto-imports gym-enrichment
- `gym-enrichment/index.ts` — 2-stage pipeline: Serper searches → Stage 1 AI (link discovery) → scrape (ScrapingAnt/Facebook/Smoothcomp) → Stage 2 AI (extraction)
- Templates declare `inputFields`, `outputFields`, `sourceOutputFields`

### Gym Enrichment Deduplication

Before enriching a gym, the worker checks `event_enrichments` table (`name_id = input.gymName`). If found → skip and mark done in source sheet. After successful enrichment → upsert to `event_enrichments` with parsed location, social media, and all extracted fields.

### Worker (`src/workers/processor.ts`)

- Started in-process via `src/app/layout.tsx` (singleton on `globalThis`)
- Concurrency: 3 parallel jobs
- Template jobs: calls `processTemplateRow()` with pre-check + DB write
- Person Finder jobs: calls `processRow()` → `runAgent()`
- Row retries: up to 5 attempts, 5s delay

### ColumnMap JSON (Job.columnMap)

**Person Finder**: `{ nameCol, filterCol, filterValue, doneCol, doneValue, rowOffset, rowLimit, outputCols: { foundGym?, instagram?, facebook?, smoothcomp?, source?, reason? } }`

**Gym Enrichment**: `{ inputCols: { gymName, location }, filterCol, filterValue, doneCol, doneValue, rowOffset, rowLimit, sourceOutputCols: { status?, aiOwner?, aiCoach? }, destOutputCols: { name?, website?, ... } }`

### External APIs

| Tool | API | File |
|------|-----|------|
| Google Search | serper.dev | `src/lib/agent/tools/serper.ts`, `gym-enrichment/index.ts` |
| Instagram | instagram-looter2 (RapidAPI) | `src/lib/agent/tools/instagram.ts` |
| Facebook (profile) | facebook-scraper3 (RapidAPI) | `src/lib/agent/tools/facebook.ts` |
| Facebook (page URL) | facebook-scraper3 (RapidAPI) | `src/lib/templates/gym-enrichment/tools/facebook-url.ts` |
| Smoothcomp | ZenRows (js_render) | `src/lib/agent/tools/smoothcomp.ts`, `gym-enrichment/tools/smoothcomp-gym.ts` |
| Website scraping | ScrapingAnt | `src/lib/templates/gym-enrichment/tools/scrapingant.ts` |
| AI | OpenRouter REST API | `src/lib/agent/index.ts`, `gym-enrichment/index.ts` |

### Key Architectural Decisions

- **Worker runs in-process**: BullMQ worker starts in `layout.tsx`, singleton on `globalThis`. Single-instance only (Redis pub/sub needed to scale SSE).
- **Encrypted storage**: All API keys (OpenRouter, Serper, RapidAPI, ZenRows, ScrapingAnt, Google SA JSON) stored AES-256-CBC encrypted in `TeamSettings`.
- **event_enrichments table**: Existing PostgreSQL table mapped via Prisma `EventEnrichment` model (`@@map("event_enrichments")`). Dedup key: `name_id` column (= input gym name).

### Path Alias

`@/*` maps to `./src/*` in tsconfig.

## Environment Variables

`DATABASE_URL`, `REDIS_URL`, `ENCRYPTION_KEY` (64 hex chars), `JWT_SECRET` (64+ chars), `APP_URL`.
Seed vars: `SUPER_ADMIN_USERNAME`, `SUPER_ADMIN_PASSWORD`, `SUPER_ADMIN_NAME`.
