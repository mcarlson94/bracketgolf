/**
 * Bracket scoring service.
 * Recalculates scores and max possible scores for all brackets.
 */
import { db } from "@workspace/db";
import {
  bracketsTable,
  bracketPicksTable,
  matchupsTable,
  golfersTable,
} from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { ROUND_POINTS, TOTAL_PICKS } from "./scoring";
import { logger } from "./logger";

/**
 * Rescore all brackets for a tournament.
 * Called after matchup results are updated.
 */
export async function rescoreAllBrackets(tournamentId: string): Promise<number> {
  const brackets = await db
    .select()
    .from(bracketsTable)
    .where(eq(bracketsTable.tournamentId, tournamentId));

  let count = 0;
  for (const bracket of brackets) {
    await rescoreBracket(bracket.id);
    count++;
  }

  // Update ranks
  await updateRanks(tournamentId);
  return count;
}

export async function rescoreBracket(bracketId: string): Promise<void> {
  const picks = await db
    .select()
    .from(bracketPicksTable)
    .where(eq(bracketPicksTable.bracketId, bracketId));

  if (picks.length === 0) return;

  // Get all matchups for these picks
  const matchupIds = [...new Set(picks.map((p) => p.matchupId))];
  const matchups = await db
    .select()
    .from(matchupsTable)
    .where(inArray(matchupsTable.id, matchupIds));

  const matchupMap = new Map(matchups.map((m) => [m.id, m]));

  // Get eliminated golfers
  const selectedGolferIds = [...new Set(picks.map((p) => p.selectedGolferId))];
  const golfers = await db
    .select()
    .from(golfersTable)
    .where(inArray(golfersTable.id, selectedGolferIds));
  const golferMap = new Map(golfers.map((g) => [g.id, g]));

  let score = 0;
  let maxPossible = 0;
  let championGolferId: string | null = null;

  for (const pick of picks) {
    const matchup = matchupMap.get(pick.matchupId);
    const golfer = golferMap.get(pick.selectedGolferId);
    const points = ROUND_POINTS[pick.round] ?? 1;

    // Find the final pick
    if (pick.round === "F") {
      championGolferId = pick.selectedGolferId;
    }

    let newStatus = "pending";
    let isCorrect: boolean | null = null;

    if (matchup?.status === "completed" && matchup.winnerId) {
      if (matchup.winnerId === pick.selectedGolferId) {
        newStatus = "correct";
        isCorrect = true;
        score += points;
        maxPossible += points;
      } else {
        newStatus = "incorrect";
        isCorrect = false;
      }
    } else if (golfer?.eliminated) {
      // Golfer was eliminated earlier — future picks for them are "eliminated"
      // Check if this pick's matchup hasn't happened yet (pending but impossible)
      if (matchup?.status !== "completed") {
        newStatus = "eliminated";
      }
    } else {
      // Still possible
      maxPossible += points;
    }

    await db
      .update(bracketPicksTable)
      .set({
        status: newStatus,
        isCorrect,
        pointsPossible: points,
      })
      .where(eq(bracketPicksTable.id, pick.id));
  }

  // Update bracket totals
  await db
    .update(bracketsTable)
    .set({
      score,
      maxPossibleScore: maxPossible,
      championGolferId,
    })
    .where(eq(bracketsTable.id, bracketId));
}

async function updateRanks(tournamentId: string): Promise<void> {
  const brackets = await db
    .select()
    .from(bracketsTable)
    .where(and(eq(bracketsTable.tournamentId, tournamentId), eq(bracketsTable.submitted, true)));

  // Sort by score desc
  const sorted = brackets.sort((a, b) => b.score - a.score || b.maxPossibleScore - a.maxPossibleScore);

  for (let i = 0; i < sorted.length; i++) {
    await db
      .update(bracketsTable)
      .set({ rank: i + 1 })
      .where(eq(bracketsTable.id, sorted[i].id));
  }
}

/**
 * Calculate bracket pick stats (totalPicks, completedPicks) for display.
 */
export function calcBracketStats(picks: Array<{ status: string }>): {
  totalPicks: number;
  completedPicks: number;
} {
  return {
    totalPicks: TOTAL_PICKS,
    completedPicks: picks.length,
  };
}
