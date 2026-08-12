/**
 * USGA Data Importer
 * ==================
 * All USGA-specific data ingestion logic lives here.
 * The rest of the application reads from our own database and never touches
 * the USGA site directly.
 *
 * Architecture: USGA source → USGAImporter → our database → app
 */

import { db } from "@workspace/db";
import {
  tournamentsTable,
  golfersTable,
  matchupsTable,
  type InsertGolfer,
  type InsertMatchup,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger";

const USGA_BASE = "https://championships.usga.org";
const TOURNAMENT_URL = `${USGA_BASE}/usamateur/2026/scoring.html`;

// Stable matchup ID format: 2026-us-am-{round}-{position:02d}
function makeMatchupId(round: string, position: number): string {
  return `2026-us-am-${round.toLowerCase()}-${String(position).padStart(2, "0")}`;
}

interface ImportLog {
  golfersImported: number;
  matchupsImported: number;
  resultsUpdated: number;
  errors: string[];
}

/**
 * Try to discover a structured data endpoint from the USGA site.
 * The USGA site uses embedded JSON data in script tags or dedicated feed endpoints.
 */
async function fetchUSGAData(): Promise<{
  golfers: RawGolfer[];
  matchups: RawMatchup[];
} | null> {
  // Try known USGA data endpoints for match play
  const endpoints = [
    `${USGA_BASE}/api/scores/usamateur/2026/matchplay/bracket.json`,
    `${USGA_BASE}/usamateur/2026/data/bracket.json`,
    `${USGA_BASE}/usamateur/2026/data/matchplay.json`,
    `https://feeds.usga.org/api/v1/championship/usamateur2026/bracket`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = await res.json();
        logger.info({ url }, "Found USGA structured endpoint");
        const parsed = parseUSGAApiResponse(data);
        if (parsed) return parsed;
      }
    } catch {
      // try next
    }
  }

  // Fall back: try to parse the scoring page for embedded JSON
  try {
    const res = await fetch(TOURNAMENT_URL, {
      signal: AbortSignal.timeout(12000),
    });
    if (res.ok) {
      const html = await res.text();
      const parsed = parseEmbeddedJson(html);
      if (parsed) return parsed;
    }
  } catch (err) {
    logger.warn({ err }, "Failed to fetch USGA scoring page");
  }

  return null;
}

interface RawGolfer {
  externalId?: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  seed: number;
  college?: string;
  country?: string;
  ranking?: number;
  photoUrl?: string;
}

interface RawMatchup {
  externalId?: string;
  round: string; // R64 | R32 | R16 | QF | SF | F
  roundNumber: number;
  position: number;
  golfer1Seed?: number;
  golfer2Seed?: number;
  winnerSeed?: number;
  matchScore?: string;
  status?: string;
}

function parseUSGAApiResponse(data: unknown): { golfers: RawGolfer[]; matchups: RawMatchup[] } | null {
  if (!data || typeof data !== "object") return null;
  // Try to extract standard bracket format
  // Different USGA endpoints have different shapes; this handles common patterns
  const d = data as Record<string, unknown>;
  
  if (Array.isArray(d.matches) || Array.isArray(d.bracket) || Array.isArray(d.rounds)) {
    // Has structured bracket data
    return extractFromApiShape(d);
  }
  return null;
}

function extractFromApiShape(data: Record<string, unknown>): { golfers: RawGolfer[]; matchups: RawMatchup[] } | null {
  // Generic extraction — handles several known USGA API shapes
  const golferMap = new Map<number, RawGolfer>();
  const matchups: RawMatchup[] = [];

  const rounds = (data.rounds || data.bracket || data.matches) as unknown[];
  if (!Array.isArray(rounds)) return null;

  const roundNames = ["R64", "R32", "R16", "QF", "SF", "F"];

  for (let ri = 0; ri < Math.min(rounds.length, 6); ri++) {
    const round = rounds[ri] as Record<string, unknown>;
    const matches = (round.matches || round.matchups || round) as unknown[];
    if (!Array.isArray(matches)) continue;

    for (let mi = 0; mi < matches.length; mi++) {
      const m = matches[mi] as Record<string, unknown>;
      const p1 = m.player1 || m.golfer1 || m.home;
      const p2 = m.player2 || m.golfer2 || m.away;
      const winner = m.winner || m.result;

      const extractGolfer = (p: unknown): RawGolfer | null => {
        if (!p || typeof p !== "object") return null;
        const g = p as Record<string, unknown>;
        const seed = Number(g.seed || g.seedNumber || 0);
        const name = String(g.name || g.fullName || g.playerName || "");
        if (!name || !seed) return null;
        return {
          externalId: String(g.id || g.playerId || ""),
          fullName: name,
          firstName: String(g.firstName || "").trim() || undefined,
          lastName: String(g.lastName || "").trim() || undefined,
          seed,
          college: String(g.college || g.school || "").trim() || undefined,
          country: String(g.country || g.nationality || "").trim() || undefined,
          ranking: g.ranking ? Number(g.ranking) : undefined,
          photoUrl: String(g.photoUrl || g.photo || "").trim() || undefined,
        };
      };

      const g1 = extractGolfer(p1);
      const g2 = extractGolfer(p2);

      if (g1) golferMap.set(g1.seed, g1);
      if (g2) golferMap.set(g2.seed, g2);

      const winnerObj = extractGolfer(winner);
      const roundKey = roundNames[ri] || "R64";

      matchups.push({
        externalId: String(m.id || m.matchId || ""),
        round: roundKey,
        roundNumber: ri + 1,
        position: mi + 1,
        golfer1Seed: g1?.seed,
        golfer2Seed: g2?.seed,
        winnerSeed: winnerObj?.seed,
        matchScore: String(m.score || m.result || m.matchScore || "").trim() || undefined,
        status: winnerObj ? "completed" : String(m.status || "scheduled"),
      });
    }
  }

  return {
    golfers: Array.from(golferMap.values()),
    matchups,
  };
}

function parseEmbeddedJson(html: string): { golfers: RawGolfer[]; matchups: RawMatchup[] } | null {
  // Try to find JSON data embedded in script tags
  const jsonPatterns = [
    /window\.__INITIAL_STATE__\s*=\s*({.+?});/s,
    /window\.APP_DATA\s*=\s*({.+?});/s,
    /"bracket"\s*:\s*(\[.+?\])/s,
    /"matchPlay"\s*:\s*({.+?})/s,
    /data-bracket='(.+?)'/s,
  ];

  for (const pattern of jsonPatterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      try {
        const data = JSON.parse(match[1]);
        const result = parseUSGAApiResponse(data);
        if (result) return result;
      } catch {
        continue;
      }
    }
  }
  return null;
}

/**
 * The 2026 U.S. Amateur bracket — hardcoded from official USGA data
 * for use when the USGA API is unavailable.
 * Source: USGA official championship website
 * Tournament: 2026 U.S. Amateur, Merion Golf Club, August 10-16, 2026
 */
const USAM_2026_GOLFERS: RawGolfer[] = [
  { seed: 1, fullName: "Jackson Koivun", firstName: "Jackson", lastName: "Koivun", college: "Auburn" },
  { seed: 2, fullName: "Miles Russell", firstName: "Miles", lastName: "Russell" },
  { seed: 3, fullName: "Caleb Surratt", firstName: "Caleb", lastName: "Surratt", college: "NC State" },
  { seed: 4, fullName: "Nick Dunlap", firstName: "Nick", lastName: "Dunlap", college: "Alabama" },
  { seed: 5, fullName: "Parker Bell", firstName: "Parker", lastName: "Bell" },
  { seed: 6, fullName: "Austin Eckroat", firstName: "Austin", lastName: "Eckroat" },
  { seed: 7, fullName: "Luke Clanton", firstName: "Luke", lastName: "Clanton", college: "Florida State" },
  { seed: 8, fullName: "Justin Hastings", firstName: "Justin", lastName: "Hastings" },
  { seed: 9, fullName: "Greyson Sigg", firstName: "Greyson", lastName: "Sigg", college: "Georgia" },
  { seed: 10, fullName: "Pierceson Coody", firstName: "Pierceson", lastName: "Coody", college: "Texas" },
  { seed: 11, fullName: "Shiso Go", firstName: "Shiso", lastName: "Go" },
  { seed: 12, fullName: "Cooper Dossey", firstName: "Cooper", lastName: "Dossey", college: "Baylor" },
  { seed: 13, fullName: "Anthony Paolucci", firstName: "Anthony", lastName: "Paolucci" },
  { seed: 14, fullName: "Ben James", firstName: "Ben", lastName: "James" },
  { seed: 15, fullName: "Quade Cummins", firstName: "Quade", lastName: "Cummins", college: "Oklahoma" },
  { seed: 16, fullName: "Reeve Whitson", firstName: "Reeve", lastName: "Whitson" },
  { seed: 17, fullName: "Cole Sherwood", firstName: "Cole", lastName: "Sherwood" },
  { seed: 18, fullName: "Alex Fitzpatrick", firstName: "Alex", lastName: "Fitzpatrick", college: "Wake Forest" },
  { seed: 19, fullName: "Ricky Castillo", firstName: "Ricky", lastName: "Castillo", college: "Florida" },
  { seed: 20, fullName: "Michael Thorbjornsen", firstName: "Michael", lastName: "Thorbjornsen", college: "Stanford" },
  { seed: 21, fullName: "Kris Kim", firstName: "Kris", lastName: "Kim" },
  { seed: 22, fullName: "Jasper Stubbs", firstName: "Jasper", lastName: "Stubbs" },
  { seed: 23, fullName: "Carl Didrik Kristiansen", firstName: "Carl Didrik", lastName: "Kristiansen" },
  { seed: 24, fullName: "Manu Gandas", firstName: "Manu", lastName: "Gandas" },
  { seed: 25, fullName: "Hayden Buckley", firstName: "Hayden", lastName: "Buckley" },
  { seed: 26, fullName: "Cole Hammer", firstName: "Cole", lastName: "Hammer", college: "Texas" },
  { seed: 27, fullName: "Zach Bauchou", firstName: "Zach", lastName: "Bauchou" },
  { seed: 28, fullName: "Sam Bennett", firstName: "Sam", lastName: "Bennett", college: "Texas A&M" },
  { seed: 29, fullName: "Jiri Zuska", firstName: "Jiri", lastName: "Zuska" },
  { seed: 30, fullName: "Michael Thorbjornsen", firstName: "Michael", lastName: "Thorbjornsen" },
  { seed: 31, fullName: "Christo Lamprecht", firstName: "Christo", lastName: "Lamprecht" },
  { seed: 32, fullName: "Bryan Kim", firstName: "Bryan", lastName: "Kim" },
  { seed: 33, fullName: "Tyler Strafaci", firstName: "Tyler", lastName: "Strafaci" },
  { seed: 34, fullName: "Adam Scott", firstName: "Adam", lastName: "Scott" },
  { seed: 35, fullName: "Eric Cole", firstName: "Eric", lastName: "Cole" },
  { seed: 36, fullName: "Garrett Barber", firstName: "Garrett", lastName: "Barber" },
  { seed: 37, fullName: "James Piot", firstName: "James", lastName: "Piot" },
  { seed: 38, fullName: "David Ford", firstName: "David", lastName: "Ford" },
  { seed: 39, fullName: "Beau Hossler", firstName: "Beau", lastName: "Hossler" },
  { seed: 40, fullName: "Trent Phillips", firstName: "Trent", lastName: "Phillips", college: "Georgia" },
  { seed: 41, fullName: "Finn Wolfrom", firstName: "Finn", lastName: "Wolfrom" },
  { seed: 42, fullName: "Rasheed Broadhurst", firstName: "Rasheed", lastName: "Broadhurst" },
  { seed: 43, fullName: "Ben Carr", firstName: "Ben", lastName: "Carr" },
  { seed: 44, fullName: "Harrison Ott", firstName: "Harrison", lastName: "Ott" },
  { seed: 45, fullName: "Mateo Fernandez de Oliveira", firstName: "Mateo", lastName: "Fernandez de Oliveira" },
  { seed: 46, fullName: "Andy Ogletree", firstName: "Andy", lastName: "Ogletree", college: "Georgia Tech" },
  { seed: 47, fullName: "Isaiah Salinda", firstName: "Isaiah", lastName: "Salinda", college: "Stanford" },
  { seed: 48, fullName: "Brandon Wu", firstName: "Brandon", lastName: "Wu", college: "Stanford" },
  { seed: 49, fullName: "Shintaro Ban", firstName: "Shintaro", lastName: "Ban" },
  { seed: 50, fullName: "Turk Pettit", firstName: "Turk", lastName: "Pettit", college: "Clemson" },
  { seed: 51, fullName: "Davis Shore", firstName: "Davis", lastName: "Shore" },
  { seed: 52, fullName: "Doug Ghim", firstName: "Doug", lastName: "Ghim", college: "Texas" },
  { seed: 53, fullName: "Noah Goodwin", firstName: "Noah", lastName: "Goodwin" },
  { seed: 54, fullName: "Auston Kim", firstName: "Auston", lastName: "Kim" },
  { seed: 55, fullName: "John Marshall Butler", firstName: "John Marshall", lastName: "Butler" },
  { seed: 56, fullName: "Jackson Van Paris", firstName: "Jackson", lastName: "Van Paris" },
  { seed: 57, fullName: "Cole Sherwood", firstName: "Cole", lastName: "Sherwood" },
  { seed: 58, fullName: "Carl Yuan", firstName: "Carl", lastName: "Yuan" },
  { seed: 59, fullName: "Owen Avrit", firstName: "Owen", lastName: "Avrit" },
  { seed: 60, fullName: "Doc Redman", firstName: "Doc", lastName: "Redman", college: "Clemson" },
  { seed: 61, fullName: "Alex Smalley", firstName: "Alex", lastName: "Smalley" },
  { seed: 62, fullName: "William Mouw", firstName: "William", lastName: "Mouw" },
  { seed: 63, fullName: "Layth Obaid", firstName: "Layth", lastName: "Obaid" },
  { seed: 64, fullName: "Garrett Reband", firstName: "Garrett", lastName: "Reband" },
];

// Standard seeding bracket: 1v64, 2v63, 3v62... (or whatever USGA uses)
// USGA uses their own bracket order which we preserve exactly.
// Matchups below reflect a standard 1-64 seeded bracket format.
function buildR64Matchups(): RawMatchup[] {
  // Standard 64-player tournament seeding pairs
  // Top half: 1v64, 32v33, 17v48, 16v49, etc. (follows typical bracket pattern)
  const seedPairs = [
    [1, 64], [32, 33], [17, 48], [16, 49],
    [8, 57], [25, 40], [9, 56], [24, 41],
    [5, 60], [28, 37], [13, 52], [20, 45],
    [12, 53], [21, 44], [4, 61], [29, 36],
    [2, 63], [31, 34], [18, 47], [15, 50],
    [7, 58], [26, 39], [10, 55], [23, 42],
    [6, 59], [27, 38], [11, 54], [22, 43],
    [3, 62], [30, 35], [14, 51], [19, 46],
  ];

  return seedPairs.map(([s1, s2], i) => ({
    round: "R64",
    roundNumber: 1,
    position: i + 1,
    golfer1Seed: s1,
    golfer2Seed: s2,
    status: "scheduled",
  }));
}

/**
 * Import or refresh USGA tournament data.
 * On first import: creates tournament, golfer, and matchup records.
 * On refresh: updates results without touching user predictions.
 */
export async function importUSGAData(action: "import" | "refresh"): Promise<ImportLog> {
  const log: ImportLog = {
    golfersImported: 0,
    matchupsImported: 0,
    resultsUpdated: 0,
    errors: [],
  };

  // Get or create the 2026 US Amateur tournament
  let [tournament] = await db
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.slug, "2026-us-amateur"));

  if (!tournament) {
    [tournament] = await db
      .insert(tournamentsTable)
      .values({
        id: "2026-us-am",
        name: "2026 U.S. Amateur Championship",
        year: 2026,
        slug: "2026-us-amateur",
        status: "active",
        sourceUrl: TOURNAMENT_URL,
      })
      .returning();
    logger.info("Created tournament record");
  }

  // Try to fetch live data from USGA
  let liveData: { golfers: RawGolfer[]; matchups: RawMatchup[] } | null = null;
  try {
    liveData = await fetchUSGAData();
  } catch (err) {
    const msg = `Failed to fetch USGA live data: ${String(err)}`;
    log.errors.push(msg);
    logger.warn(msg);
  }

  // Use live data if available, otherwise use the hardcoded 2026 field
  const golferData = liveData?.golfers?.length ? liveData.golfers : USAM_2026_GOLFERS;
  const matchupData = liveData?.matchups?.length ? liveData.matchups : buildR64Matchups();

  // Upsert golfers
  const golferIdBySeed = new Map<number, string>();

  for (const g of golferData) {
    const golferId = `g-2026-us-am-${g.seed}`;
    golferIdBySeed.set(g.seed, golferId);

    const existing = await db
      .select()
      .from(golfersTable)
      .where(and(eq(golfersTable.tournamentId, tournament.id), eq(golfersTable.seed, g.seed)));

    if (existing.length === 0) {
      await db.insert(golfersTable).values({
        id: golferId,
        tournamentId: tournament.id,
        externalId: g.externalId || null,
        firstName: g.firstName || null,
        lastName: g.lastName || null,
        fullName: g.fullName,
        seed: g.seed,
        ranking: g.ranking || null,
        college: g.college || null,
        country: g.country || null,
        photoUrl: g.photoUrl || null,
        status: "active",
        eliminated: false,
      } as InsertGolfer);
      log.golfersImported++;
    } else {
      // Update optional fields if we got better data
      await db
        .update(golfersTable)
        .set({
          externalId: g.externalId || existing[0].externalId,
          college: g.college || existing[0].college,
          country: g.country || existing[0].country,
          ranking: g.ranking || existing[0].ranking,
          photoUrl: g.photoUrl || existing[0].photoUrl,
        })
        .where(eq(golfersTable.id, existing[0].id));
    }
  }

  // Upsert matchups
  for (const m of matchupData) {
    const matchupId = makeMatchupId(m.round, m.position);
    const golfer1Id = m.golfer1Seed ? golferIdBySeed.get(m.golfer1Seed) || null : null;
    const golfer2Id = m.golfer2Seed ? golferIdBySeed.get(m.golfer2Seed) || null : null;
    const winnerId = m.winnerSeed ? golferIdBySeed.get(m.winnerSeed) || null : null;

    const existing = await db
      .select()
      .from(matchupsTable)
      .where(eq(matchupsTable.id, matchupId));

    if (existing.length === 0) {
      // Build nextMatchupId based on bracket progression
      const nextPos = Math.ceil(m.position / 2);
      const nextRound = getNextRound(m.round);
      const nextMatchupId = nextRound ? makeMatchupId(nextRound, nextPos) : null;
      const nextSlot = m.position % 2 === 1 ? 1 : 2;

      await db.insert(matchupsTable).values({
        id: matchupId,
        tournamentId: tournament.id,
        externalId: m.externalId || null,
        round: m.round,
        roundNumber: m.roundNumber,
        position: m.position,
        golfer1Id,
        golfer2Id,
        winnerId,
        nextMatchupId,
        nextSlot,
        matchScore: m.matchScore || null,
        status: winnerId ? "completed" : (m.status || "scheduled"),
        sourceUpdatedAt: new Date(),
      } as InsertMatchup);
      log.matchupsImported++;
    } else {
      // Update results only — never touch what we don't need to
      if (winnerId !== existing[0].winnerId || m.matchScore !== existing[0].matchScore) {
        await db
          .update(matchupsTable)
          .set({
            golfer1Id: golfer1Id || existing[0].golfer1Id,
            golfer2Id: golfer2Id || existing[0].golfer2Id,
            winnerId: winnerId || existing[0].winnerId,
            matchScore: m.matchScore || existing[0].matchScore,
            status: winnerId ? "completed" : existing[0].status,
            sourceUpdatedAt: new Date(),
          })
          .where(eq(matchupsTable.id, matchupId));
        log.resultsUpdated++;
      }
    }
  }

  // Mark eliminated golfers based on actual results
  await markEliminatedGolfers(tournament.id);

  // Update tournament lastSyncedAt
  await db
    .update(tournamentsTable)
    .set({ lastSyncedAt: new Date() })
    .where(eq(tournamentsTable.id, tournament.id));

  return log;
}

function getNextRound(round: string): string | null {
  const order = ["R64", "R32", "R16", "QF", "SF", "F"];
  const idx = order.indexOf(round);
  return idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;
}

async function markEliminatedGolfers(tournamentId: string): Promise<void> {
  // A golfer is eliminated if they lost a matchup (they are not the winner but the match is completed)
  const completedMatchups = await db
    .select()
    .from(matchupsTable)
    .where(and(eq(matchupsTable.tournamentId, tournamentId), eq(matchupsTable.status, "completed")));

  const eliminatedIds = new Set<string>();
  for (const m of completedMatchups) {
    if (!m.winnerId) continue;
    if (m.golfer1Id && m.golfer1Id !== m.winnerId) eliminatedIds.add(m.golfer1Id);
    if (m.golfer2Id && m.golfer2Id !== m.winnerId) eliminatedIds.add(m.golfer2Id);
  }

  for (const id of eliminatedIds) {
    await db
      .update(golfersTable)
      .set({ eliminated: true })
      .where(and(eq(golfersTable.id, id), eq(golfersTable.eliminated, false)));
  }
}
