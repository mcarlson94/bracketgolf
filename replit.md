# Bracket Golf

An ESPN Tournament Challenge-style bracket contest for the 2026 U.S. Amateur Golf Championship. Users fill out a 64-player single-elimination bracket, pick match winners, and compete on a leaderboard.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/bracket-golf run dev` — run the frontend (port auto-assigned)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + Wouter + TanStack Query
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (v3), Drizzle-Zod
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Session: Cookie-based (cookie-parser), simple name-based login for MVP

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/db/src/schema/` — database schema (users, tournaments, golfers, matchups, brackets, picks, groups)
- `artifacts/api-server/src/routes/` — API route handlers
- `artifacts/api-server/src/lib/usga-importer.ts` — USGA data ingestion service
- `artifacts/api-server/src/lib/scoring.ts` — centralized scoring config (ROUND_POINTS)
- `artifacts/api-server/src/lib/scoring-service.ts` — bracket rescoring logic
- `artifacts/api-server/src/lib/session.ts` — cookie-based session helpers
- `artifacts/bracket-golf/src/` — React frontend

## Architecture decisions

- USGA source → USGAImporter → our DB → frontend. Frontend never scrapes USGA directly.
- Stable matchup IDs: `2026-us-am-r64-01` format — not tied to volatile external URLs.
- Bracket picks cascade-clear when user changes an earlier pick (before lock); after lock, picks are preserved and marked correct/incorrect/eliminated.
- Session is a plain cookie with userId for MVP; brackets are owned by userId so real auth can be swapped in later without rebuilding the bracket system.
- Orval v8 generates zod.int() (Zod v4 API); post-process with `sed 's/zod\.int()/zod.number()/g'` after codegen since workspace uses Zod v3.
- Scoring: R64=1pt, R32=2pt, R16=4pt, QF=8pt, SF=16pt, F=32pt — centralized in scoring.ts.

## Product

- Public landing page with hero and "Make Your Picks" CTA
- Name-based login (no password — enter a name, get that user's account)
- Bracket editor: full 64-player bracket, click golfer to advance, autosave, cascade clearing
- Mobile bracket: round navigator tabs, vertical matchup cards, sticky progress bar
- Leaderboard: rank by score, champion pick display, current user rank highlighted
- Groups: create/join via join code, group leaderboard
- Admin panel: import/refresh USGA data, manual result entry, lock time control, rescore trigger

## User preferences

_Populate as you build._

## Gotchas

- After changing openapi.yaml, run codegen and then `sed -i 's/zod\.int()/zod.number()/g' lib/api-zod/src/generated/api.ts` to fix the Zod v3/v4 incompatibility.
- Do not add leaf artifact packages to the root tsconfig.json references.
- The Matchup schema has golfer1/golfer2/winner fields — these are optional (nullable) on the API but defined as non-null refs in some places; treat them as potentially null in the frontend.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- USGA data: tournament data is imported via `/api/admin/import` (POST, action: "import") from the admin panel
- Scoring max: 32*1 + 16*2 + 8*4 + 4*8 + 2*16 + 1*32 = 192 total possible points
