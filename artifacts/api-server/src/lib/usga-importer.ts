/**
 * USGA Data Importer
 * ==================
 * Fetches live data from the USGA's ace-api.usga.org scoring API.
 * Architecture: USGA source → USGAImporter → our database → app
 *
 * API discovered from the USGA scoring page JavaScript bundle:
 *   https://ace-api.usga.org/scoring/v1/scoring.json?championship=usam&championship-year=2026
 * This endpoint returns both strokeplay standings and matchplay bracket in one response.
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

const CHAMPIONSHIP = "usam";
const YEAR = 2026;
const USGA_SCORING_URL = `https://ace-api.usga.org/scoring/v1/scoring.json?championship=${CHAMPIONSHIP}&championship-year=${YEAR}`;
const USGA_REFERER = "https://championships.usga.org/usamateur/2026/scoring.html";

/** Browser-like headers required to access the USGA API (Akamai WAF bypass) */
const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: USGA_REFERER,
  Origin: "https://championships.usga.org",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-site",
};

function makeMatchupId(round: string, position: number): string {
  return `2026-us-am-${round.toLowerCase()}-${String(position).padStart(2, "0")}`;
}

const ROUND_NAMES = ["R64", "R32", "R16", "QF", "SF", "F"];

interface RawGolfer {
  externalId: string;
  fullName: string;
  firstName: string;
  lastName: string;
  seed: number;
  country?: string;
}

interface RawMatchup {
  externalId?: string;
  round: string;
  roundNumber: number;
  position: number;
  golfer1Seed?: number;
  golfer2Seed?: number;
  winnerSeed?: number;
  matchScore?: string;
  status: string;
  teeTime?: string;
}

interface ImportLog {
  golfersImported: number;
  matchupsImported: number;
  resultsUpdated: number;
  errors: string[];
  source: string;
}

/** Fetch live data from the USGA ACE API */
async function fetchLiveUSGAData(): Promise<{
  golfers: RawGolfer[];
  matchups: RawMatchup[];
} | null> {
  try {
    const res = await fetch(USGA_SCORING_URL, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      logger.warn({ status: res.status, url: USGA_SCORING_URL }, "USGA API returned non-OK status");
      return null;
    }

    const data = (await res.json()) as Record<string, unknown>;
    return parseUSGAScoringResponse(data);
  } catch (err) {
    logger.warn({ err }, "Failed to fetch live USGA data");
    return null;
  }
}

function parseUSGAScoringResponse(data: Record<string, unknown>): {
  golfers: RawGolfer[];
  matchups: RawMatchup[];
} | null {
  const matchplay = data.matchplay as Record<string, unknown> | undefined;
  if (!matchplay) return null;

  const rounds = matchplay.rounds as unknown[];
  if (!Array.isArray(rounds) || rounds.length === 0) return null;

  const golferMap = new Map<number, RawGolfer>();
  const matchups: RawMatchup[] = [];

  rounds.forEach((round, ri) => {
    const r = round as Record<string, unknown>;
    const roundName = ROUND_NAMES[ri] ?? `R${ri}`;
    const matches = r.matches as unknown[];
    if (!Array.isArray(matches)) return;

    matches.forEach((match) => {
      const m = match as Record<string, unknown>;
      const players = m.players as unknown[];
      if (!Array.isArray(players)) return;

      const p1 = players[0] as Record<string, unknown> | undefined;
      const p2 = players[1] as Record<string, unknown> | undefined;

      const extractGolfer = (p: Record<string, unknown> | undefined): RawGolfer | null => {
        if (!p) return null;
        const seed = parseInt(String(p.seed || "0"));
        const name = String(p.name || "");
        const player = p.player as Record<string, unknown> | undefined;
        if (!seed || !name) return null;
        return {
          externalId: String(p.identifier || ""),
          fullName: name,
          firstName: String(player?.firstName || "").trim(),
          lastName: String(player?.lastName || "").trim(),
          seed,
          country: String((player?.country as Record<string, unknown>)?.name || "").trim() || undefined,
        };
      };

      const g1 = extractGolfer(p1);
      const g2 = extractGolfer(p2);

      if (g1) golferMap.set(g1.seed, g1);
      if (g2) golferMap.set(g2.seed, g2);

      // Determine winner: check for W/win status in player data
      let winnerSeed: number | undefined;
      const standing = String(m.standing || "");
      const matchStatus = String(m.status || "");

      // Check player statuses for a winner
      for (const p of [p1, p2]) {
        if (!p) continue;
        const pStatus = String(p.matchStatus || p.roundStatus || p.status || "").toLowerCase();
        if (pStatus === "w" || pStatus === "won" || pStatus === "winner") {
          winnerSeed = parseInt(String(p.seed || "0")) || undefined;
        }
      }

      // Also check the leader field — for completed matches the leader is the winner
      // If standing looks like a final score (e.g. "3 and 2", "1 up") and leader is set,
      // the leader won. But we need a way to tell if the match is actually done.
      // Heuristic: if golfer2Seed is set AND standing has content AND status !== "In Progress"
      //            AND status !== "Not Started", treat as completed.
      const leader = String(m.leader || "");
      if (!winnerSeed && leader && g1 && g2 && standing && matchStatus.toLowerCase() !== "in progress") {
        const leaderNum = leader;
        if (p1 && String(p1.number) === leaderNum) winnerSeed = g1.seed;
        else if (p2 && String(p2.number) === leaderNum) winnerSeed = g2.seed;
      }

      const status =
        winnerSeed
          ? "completed"
          : matchStatus.toLowerCase().includes("progress")
          ? "in_progress"
          : "scheduled";

      const teeTimeRaw = String(m.teeTime || "");

      matchups.push({
        externalId: String(m.identifier || ""),
        round: roundName,
        roundNumber: ri + 1,
        position: parseInt(String(m.number || "1")),
        golfer1Seed: g1?.seed,
        golfer2Seed: g2?.seed,
        winnerSeed,
        matchScore: standing || undefined,
        status,
        teeTime: teeTimeRaw || undefined,
      });
    });
  });

  if (golferMap.size === 0) return null;

  return {
    golfers: Array.from(golferMap.values()),
    matchups,
  };
}

/**
 * Import or refresh USGA tournament data.
 * On first import: creates tournament, golfer, and matchup records.
 * On refresh: updates results without touching user picks.
 */
export async function importUSGAData(action: "import" | "refresh"): Promise<ImportLog> {
  const log: ImportLog = {
    golfersImported: 0,
    matchupsImported: 0,
    resultsUpdated: 0,
    errors: [],
    source: "unknown",
  };

  // Get or create the 2026 US Amateur tournament record
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
        sourceUrl: USGA_REFERER,
      })
      .returning();
    logger.info("Created tournament record");
  }

  // Fetch live data from USGA
  const liveData = await fetchLiveUSGAData();

  let golferData: RawGolfer[];
  let matchupData: RawMatchup[];

  if (liveData && liveData.golfers.length >= 32) {
    golferData = liveData.golfers;
    matchupData = liveData.matchups;
    log.source = "usga-live";
    logger.info({ golfers: golferData.length, matchups: matchupData.length }, "Using live USGA data");
  } else {
    // Fall back to the confirmed 2026 US Amateur field
    golferData = USAM_2026_GOLFERS;
    matchupData = buildR64Matchups();
    log.source = "fallback";
    log.errors.push("Could not reach USGA live API — using confirmed 2026 field fallback");
    logger.warn("Falling back to hardcoded 2026 US Amateur field");
  }

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
        ranking: null,
        college: null,
        country: g.country || null,
        photoUrl: null,
        status: "active",
        eliminated: false,
      } as InsertGolfer);
      log.golfersImported++;
    } else {
      // Update name and external ID if we got better data from the live API
      if (log.source === "usga-live") {
        await db
          .update(golfersTable)
          .set({
            externalId: g.externalId || existing[0].externalId,
            firstName: g.firstName || existing[0].firstName,
            lastName: g.lastName || existing[0].lastName,
            fullName: g.fullName || existing[0].fullName,
            country: g.country || existing[0].country,
          })
          .where(eq(golfersTable.id, existing[0].id));
      }
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
        teeTime: m.teeTime ? new Date(m.teeTime) : null,
        status: winnerId ? "completed" : m.status,
        sourceUpdatedAt: new Date(),
      } as InsertMatchup);
      log.matchupsImported++;
    } else {
      // Only update results — never touch non-result fields
      const newTeeTime = m.teeTime ? new Date(m.teeTime).toISOString() : null;
      const existingTeeTime = existing[0].teeTime ? existing[0].teeTime.toISOString() : null;
      const changed =
        winnerId !== existing[0].winnerId ||
        m.matchScore !== existing[0].matchScore ||
        newTeeTime !== existingTeeTime ||
        (golfer1Id && golfer1Id !== existing[0].golfer1Id) ||
        (golfer2Id && golfer2Id !== existing[0].golfer2Id);

      if (changed) {
        await db
          .update(matchupsTable)
          .set({
            golfer1Id: golfer1Id || existing[0].golfer1Id,
            golfer2Id: golfer2Id || existing[0].golfer2Id,
            winnerId: winnerId || existing[0].winnerId,
            matchScore: m.matchScore || existing[0].matchScore,
            teeTime: m.teeTime ? new Date(m.teeTime) : existing[0].teeTime,
            status: winnerId ? "completed" : m.status !== "scheduled" ? m.status : existing[0].status,
            sourceUpdatedAt: new Date(),
          })
          .where(eq(matchupsTable.id, matchupId));
        log.resultsUpdated++;
      }
    }
  }

  // Ensure the full 63-matchup bracket structure always exists.
  // Future rounds (R16–F) have null golfers until results come in;
  // we create the shells so picks can be made against them.
  await ensureFullBracketStructure(tournament.id);

  await markEliminatedGolfers(tournament.id);

  await db
    .update(tournamentsTable)
    .set({ lastSyncedAt: new Date() })
    .where(eq(tournamentsTable.id, tournament.id));

  logger.info(log, "USGA import complete");
  return log;
}

function getNextRound(round: string): string | null {
  const idx = ROUND_NAMES.indexOf(round);
  return idx >= 0 && idx < ROUND_NAMES.length - 1 ? ROUND_NAMES[idx + 1] : null;
}

async function markEliminatedGolfers(tournamentId: string): Promise<void> {
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

/**
 * Confirmed 2026 U.S. Amateur match play field — all 64 qualifiers.
 * Source: USGA ace-api.usga.org live scoring data (August 12, 2026).
 * Used as fallback when the live API is unreachable.
 */
const USAM_2026_GOLFERS: RawGolfer[] = [
  { seed: 1,  externalId: "12936343191703048259", fullName: "Joshua Ryan",           firstName: "Joshua",  lastName: "Ryan",           country: "United States of America" },
  { seed: 2,  externalId: "12936343191568828929", fullName: "Tyler Watts",            firstName: "Tyler",   lastName: "Watts",           country: "United States of America" },
  { seed: 3,  externalId: "12936343191568829921", fullName: "Drake Harvey",           firstName: "Drake",   lastName: "Harvey",          country: "United States of America" },
  { seed: 4,  externalId: "12936343191703047267", fullName: "Finn Koelle",            firstName: "Finn",    lastName: "Koelle",          country: "Germany" },
  { seed: 5,  externalId: "12936343191568829473", fullName: "Jackson Ormond",         firstName: "Jackson", lastName: "Ormond",          country: "United States of America" },
  { seed: 6,  externalId: "12936343191568829345", fullName: "Miles Russell",          firstName: "Miles",   lastName: "Russell",         country: "United States of America" },
  { seed: 7,  externalId: "12936343191568829697", fullName: "Jack Turner",            firstName: "Jack",    lastName: "Turner",          country: "United States of America" },
  { seed: 8,  externalId: "12936343191568828673", fullName: "Carter Loflin",          firstName: "Carter",  lastName: "Loflin",          country: "United States of America" },
  { seed: 9,  externalId: "12936343191703047779", fullName: "Malan Potgieter",        firstName: "Malan",   lastName: "Potgieter",       country: "South Africa" },
  { seed: 10, externalId: "12936343191703047523", fullName: "Eliot Baker",            firstName: "Eliot",   lastName: "Baker",           country: "England" },
  { seed: 11, externalId: "12936343191568829153", fullName: "Logan Reilly",           firstName: "Logan",   lastName: "Reilly",          country: "United States of America" },
  { seed: 12, externalId: "12936343191568829025", fullName: "Boston Bracken",         firstName: "Boston",  lastName: "Bracken",         country: "United States of America" },
  { seed: 13, externalId: "12936343191568828801", fullName: "Tyson Shelley",          firstName: "Tyson",   lastName: "Shelley",         country: "United States of America" },
  { seed: 14, externalId: "12936343191703047011", fullName: "Nevill Ruiter",          firstName: "Nevill",  lastName: "Ruiter",          country: "Netherlands" },
  { seed: 15, externalId: "12936343191568828545", fullName: "Jay Leng Jr.",           firstName: "Jay",     lastName: "Leng Jr.",        country: "United States of America" },
  { seed: 16, externalId: "12936343191568829569", fullName: "Noah Kent",              firstName: "Noah",    lastName: "Kent",            country: "United States of America" },
  { seed: 17, externalId: "12936343191703046755", fullName: "Connor Graham",          firstName: "Connor",  lastName: "Graham",          country: "Scotland" },
  { seed: 18, externalId: "12936343191703046499", fullName: "Zackary Swanwick",       firstName: "Zackary", lastName: "Swanwick",        country: "New Zealand" },
  { seed: 19, externalId: "12936343191568829825", fullName: "Michael Lugiano",        firstName: "Michael", lastName: "Lugiano",         country: "United States of America" },
  { seed: 20, externalId: "12936343191568828417", fullName: "Max Herendeen",          firstName: "Max",     lastName: "Herendeen",       country: "United States of America" },
  { seed: 21, externalId: "12936343191703046243", fullName: "Sergio Jimenez Romero",  firstName: "Sergio",  lastName: "Jimenez Romero",  country: "Spain" },
  { seed: 22, externalId: "12936343191568829249", fullName: "Aiden Krafft",           firstName: "Aiden",   lastName: "Krafft",          country: "United States of America" },
  { seed: 23, externalId: "12936343191703045987", fullName: "Rudy Sautron",           firstName: "Rudy",    lastName: "Sautron",         country: "France" },
  { seed: 24, externalId: "12936343191568828161", fullName: "Jack Beauchamp",         firstName: "Jack",    lastName: "Beauchamp",       country: "United States of America" },
  { seed: 25, externalId: "12936343191703045731", fullName: "Wolfgang Glawe",         firstName: "Wolfgang",lastName: "Glawe",           country: "Germany" },
  { seed: 26, externalId: "12936343191568828289", fullName: "Wheaton Ennis",          firstName: "Wheaton", lastName: "Ennis",           country: "United States of America" },
  { seed: 27, externalId: "12936343191703045475", fullName: "Justin Matthews",        firstName: "Justin",  lastName: "Matthews",        country: "Canada" },
  { seed: 28, externalId: "12936343191703045219", fullName: "Virgilio Paz",           firstName: "Virgilio",lastName: "Paz",             country: "Venezuela" },
  { seed: 29, externalId: "12936343191703044963", fullName: "Adam Bresnu",            firstName: "Adam",    lastName: "Bresnu",          country: "Morocco" },
  { seed: 30, externalId: "12936343191568828033", fullName: "Ryan Downes",            firstName: "Ryan",    lastName: "Downes",          country: "United States of America" },
  { seed: 31, externalId: "12936343191703044707", fullName: "Tianyi Xiong",           firstName: "Tianyi",  lastName: "Xiong",           country: "People's Republic Of China" },
  { seed: 32, externalId: "12936343191568827905", fullName: "Grady Brame Jr.",        firstName: "Grady",   lastName: "Brame Jr.",       country: "United States of America" },
  { seed: 33, externalId: "12936343191300395407", fullName: "Gaven Lane",             firstName: "Gaven",   lastName: "Lane",            country: "United States of America" },
  { seed: 34, externalId: "12936343191568831101", fullName: "Anson Munzlinger",       firstName: "Anson",   lastName: "Munzlinger",      country: "United States of America" },
  { seed: 35, externalId: "12936343191703044451", fullName: "Stewart Hagestad",       firstName: "Stewart", lastName: "Hagestad",        country: "United States of America" },
  { seed: 36, externalId: "12936343191568831229", fullName: "Ward Harris",            firstName: "Ward",    lastName: "Harris",          country: "United States of America" },
  { seed: 37, externalId: "12936343191568831357", fullName: "Bowen Mauss",            firstName: "Bowen",   lastName: "Mauss",           country: "United States of America" },
  { seed: 38, externalId: "12936343191568831485", fullName: "Caleb Bond",             firstName: "Caleb",   lastName: "Bond",            country: "United States of America" },
  { seed: 39, externalId: "12936343191703044195", fullName: "Niall Sheils Donegan",   firstName: "Niall",   lastName: "Sheils Donegan",  country: "Scotland" },
  { seed: 40, externalId: "12936343191703043939", fullName: "Byungho Lee",            firstName: "Byungho", lastName: "Lee",             country: "Republic of Korea" },
  { seed: 41, externalId: "12936343191568831613", fullName: "Hampton Roberts",        firstName: "Hampton", lastName: "Roberts",         country: "United States of America" },
  { seed: 42, externalId: "12936343191568831741", fullName: "Matthew Lowe",           firstName: "Matthew", lastName: "Lowe",            country: "United States of America" },
  { seed: 43, externalId: "12936343191568831869", fullName: "Evan Liu",               firstName: "Evan",    lastName: "Liu",             country: "United States of America" },
  { seed: 44, externalId: "12936343191703043683", fullName: "Dawson Lew",             firstName: "Dawson",  lastName: "Lew",             country: "Canada" },
  { seed: 45, externalId: "12936343191568831997", fullName: "McCoy Biagioli",         firstName: "McCoy",   lastName: "Biagioli",        country: "United States of America" },
  { seed: 46, externalId: "12936343191568832125", fullName: "Chase Hughes",           firstName: "Chase",   lastName: "Hughes",          country: "United States of America" },
  { seed: 47, externalId: "12936343191568832253", fullName: "Josiah Gilbert",         firstName: "Josiah",  lastName: "Gilbert",         country: "United States of America" },
  { seed: 48, externalId: "12936343191568832381", fullName: "Brandon Knight",         firstName: "Brandon", lastName: "Knight",          country: "United States of America" },
  { seed: 49, externalId: "12936343191568832509", fullName: "Kailer Stone",           firstName: "Kailer",  lastName: "Stone",           country: "United States of America" },
  { seed: 50, externalId: "12936343191568832637", fullName: "Evan Beck",              firstName: "Evan",    lastName: "Beck",            country: "United States of America" },
  { seed: 51, externalId: "12936343191703043427", fullName: "William Lisle",          firstName: "William", lastName: "Lisle",           country: "Hong Kong China" },
  { seed: 52, externalId: "12936343191568832765", fullName: "Carson Bertagnole",      firstName: "Carson",  lastName: "Bertagnole",      country: "United States of America" },
  { seed: 53, externalId: "12936343191568832893", fullName: "Christian Cavaliere",    firstName: "Christian",lastName: "Cavaliere",      country: "United States of America" },
  { seed: 54, externalId: "12936343191568830973", fullName: "Emile Lebrun",           firstName: "Emile",   lastName: "Lebrun",          country: "Canada" },
  { seed: 55, externalId: "12936343191703043171", fullName: "Joshua Bai",             firstName: "Joshua",  lastName: "Bai",             country: "New Zealand" },
  { seed: 56, externalId: "12936343191568833021", fullName: "William Jennings",       firstName: "William", lastName: "Jennings",        country: "United States of America" },
  { seed: 57, externalId: "12936343191568833149", fullName: "Grayson Wood",           firstName: "Grayson", lastName: "Wood",            country: "United States of America" },
  { seed: 58, externalId: "12936343191703042915", fullName: "Fifa Laopakdee",         firstName: "Fifa",    lastName: "Laopakdee",       country: "Thailand" },
  { seed: 59, externalId: "12936343191568833277", fullName: "Ryder Cowan",            firstName: "Ryder",   lastName: "Cowan",           country: "United States of America" },
  { seed: 60, externalId: "12936343191703042659", fullName: "Jack Whaley",            firstName: "Jack",    lastName: "Whaley",          country: "England" },
  { seed: 61, externalId: "12936343191568833405", fullName: "Kihei Akina",            firstName: "Kihei",   lastName: "Akina",           country: "United States of America" },
  { seed: 62, externalId: "12936343191568833533", fullName: "William Love",           firstName: "William", lastName: "Love",            country: "United States of America" },
  { seed: 63, externalId: "12936343191568833661", fullName: "Parker Sands",           firstName: "Parker",  lastName: "Sands",           country: "United States of America" },
  { seed: 64, externalId: "12936343191568830717", fullName: "Taishi Moto",            firstName: "Taishi",  lastName: "Moto",            country: "Japan" },
];

/**
 * Ensure the full 63-matchup bracket shell exists in the DB.
 * R16–Final start with null golfers; they fill in as results come in.
 * This is idempotent — safe to call on every import cycle.
 */
async function ensureFullBracketStructure(tournamentId: string): Promise<void> {
  type Shell = { id: string; round: string; roundNumber: number; position: number; nextMatchupId: string | null; nextSlot: number | null };

  const shells: Shell[] = [
    // R16 (8)
    { id: `${tournamentId}-r16-01`, round: "R16", roundNumber: 3, position: 1, nextMatchupId: `${tournamentId}-qf-01`, nextSlot: 1 },
    { id: `${tournamentId}-r16-02`, round: "R16", roundNumber: 3, position: 2, nextMatchupId: `${tournamentId}-qf-01`, nextSlot: 2 },
    { id: `${tournamentId}-r16-03`, round: "R16", roundNumber: 3, position: 3, nextMatchupId: `${tournamentId}-qf-02`, nextSlot: 1 },
    { id: `${tournamentId}-r16-04`, round: "R16", roundNumber: 3, position: 4, nextMatchupId: `${tournamentId}-qf-02`, nextSlot: 2 },
    { id: `${tournamentId}-r16-05`, round: "R16", roundNumber: 3, position: 5, nextMatchupId: `${tournamentId}-qf-03`, nextSlot: 1 },
    { id: `${tournamentId}-r16-06`, round: "R16", roundNumber: 3, position: 6, nextMatchupId: `${tournamentId}-qf-03`, nextSlot: 2 },
    { id: `${tournamentId}-r16-07`, round: "R16", roundNumber: 3, position: 7, nextMatchupId: `${tournamentId}-qf-04`, nextSlot: 1 },
    { id: `${tournamentId}-r16-08`, round: "R16", roundNumber: 3, position: 8, nextMatchupId: `${tournamentId}-qf-04`, nextSlot: 2 },
    // QF (4)
    { id: `${tournamentId}-qf-01`, round: "QF", roundNumber: 4, position: 1, nextMatchupId: `${tournamentId}-sf-01`, nextSlot: 1 },
    { id: `${tournamentId}-qf-02`, round: "QF", roundNumber: 4, position: 2, nextMatchupId: `${tournamentId}-sf-01`, nextSlot: 2 },
    { id: `${tournamentId}-qf-03`, round: "QF", roundNumber: 4, position: 3, nextMatchupId: `${tournamentId}-sf-02`, nextSlot: 1 },
    { id: `${tournamentId}-qf-04`, round: "QF", roundNumber: 4, position: 4, nextMatchupId: `${tournamentId}-sf-02`, nextSlot: 2 },
    // SF (2)
    { id: `${tournamentId}-sf-01`, round: "SF", roundNumber: 5, position: 1, nextMatchupId: `${tournamentId}-f-01`, nextSlot: 1 },
    { id: `${tournamentId}-sf-02`, round: "SF", roundNumber: 5, position: 2, nextMatchupId: `${tournamentId}-f-01`, nextSlot: 2 },
    // F (1)
    { id: `${tournamentId}-f-01`, round: "F", roundNumber: 6, position: 1, nextMatchupId: null, nextSlot: null },
  ];

  for (const s of shells) {
    const existing = await db.select().from(matchupsTable).where(eq(matchupsTable.id, s.id));
    if (existing.length === 0) {
      await db.insert(matchupsTable).values({
        id: s.id,
        tournamentId,
        round: s.round,
        roundNumber: s.roundNumber,
        position: s.position,
        golfer1Id: null,
        golfer2Id: null,
        winnerId: null,
        nextMatchupId: s.nextMatchupId,
        nextSlot: s.nextSlot,
        status: "scheduled",
        sourceUpdatedAt: new Date(),
      } as InsertMatchup);
    }
  }
}

/**
 * Standard 64-player match play seeding bracket.
 * Matches the USGA's actual bracket structure for the 2026 US Amateur.
 */
function buildR64Matchups(): RawMatchup[] {
  const seedPairs: [number, number][] = [
    [1, 64], [32, 33], [16, 49], [17, 48],
    [8, 57], [25, 40], [9, 56], [24, 41],
    [5, 60], [29, 36], [13, 52], [20, 45],
    [12, 53], [21, 44], [4, 61], [28, 37],
    [2, 63], [31, 34], [15, 50], [18, 47],
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
