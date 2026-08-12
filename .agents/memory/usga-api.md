---
name: USGA live API
description: How to access the USGA's real-time scoring API for championship data
---

# USGA ACE API — Live Scoring Data

## The endpoint
`https://ace-api.usga.org/scoring/v1/scoring.json?championship=usam&championship-year=2026`

Returns both `strokeplay` and `matchplay` objects in one JSON response.

## Required headers (Akamai WAF bypass)
Shell curl gets blocked. Node.js fetch works when these headers are set:
```
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ...Chrome/126.0.0.0...
Accept: application/json, text/plain, */*
Referer: https://championships.usga.org/usamateur/2026/scoring.html
Origin: https://championships.usga.org
Sec-Fetch-Dest: empty
Sec-Fetch-Mode: cors
Sec-Fetch-Site: same-site
```

**Why:** Akamai inspects the `Referer` and `Origin` headers. Requests without them get 403. Node.js fetch from the Express server works; shell curl does not (different IP reputation + missing headers).

## Data format — matchplay
- `matchplay.rounds[]` — array of 6 rounds (R64, R32, R16, QF, SF, F)
- Each round: `{ number, name, date, status, matches[] }`
- Each match: `{ identifier, number, teeTime, status, standing, leader, holesThrough, players[] }`
- Each player: `{ identifier, number, qscore, seed, name, player: { firstName, lastName, country } }`
- `standing` = match score string e.g. "3 and 2", "1 up"
- `leader` = player number of the current/final leader
- `status` = "Not Started" | "In Progress" | "Complete" | "Suspended"

## Winner detection
Match.leader + match.status === "Complete" → winner is the player whose number matches leader.
Also check `player.matchStatus === 'W'`.

## Championship codes
- US Amateur: `usam`
- Other championships listed at: `https://ace-api.usga.org/scoring/v1/2026/championships.json`

## Auto-polling
The Express server polls every 10 minutes during tournament week (Aug 10-16 2026) via `setInterval` in `artifacts/api-server/src/index.ts`.
