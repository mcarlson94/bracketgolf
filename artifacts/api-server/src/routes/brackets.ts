import { Router, type IRouter } from "express";
import { db, bracketsTable, bracketPicksTable, tournamentsTable, matchupsTable, golfersTable } from "@workspace/db";
import { eq, and, asc, inArray } from "drizzle-orm";
import { CreateBracketBody, GetBracketParams, DeleteBracketParams, SubmitBracketParams, SavePickBody, SavePickParams } from "@workspace/api-zod";
import { getSessionUserId } from "../lib/session";
import { ROUND_POINTS, TOTAL_PICKS } from "../lib/scoring";
import { rescoreBracket } from "../lib/scoring-service";
import { randomUUID } from "crypto";

const router: IRouter = Router();

function requireAuth(req: Parameters<Parameters<typeof router.get>[1]>[0], res: Parameters<Parameters<typeof router.get>[1]>[1]): string | null {
  const userId = getSessionUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return userId;
}

// Serialize a bracket record with computed fields
async function serializeBracket(bracket: typeof bracketsTable.$inferSelect) {
  const picks = await db
    .select()
    .from(bracketPicksTable)
    .where(eq(bracketPicksTable.bracketId, bracket.id));

  // Get champion name if set
  let championName: string | null = null;
  if (bracket.championGolferId) {
    const [champ] = await db.select().from(golfersTable).where(eq(golfersTable.id, bracket.championGolferId));
    championName = champ?.fullName ?? null;
  }

  return {
    id: bracket.id,
    userId: bracket.userId,
    tournamentId: bracket.tournamentId,
    name: bracket.name,
    submitted: bracket.submitted,
    submittedAt: bracket.submittedAt?.toISOString() ?? null,
    score: bracket.score,
    maxPossibleScore: bracket.maxPossibleScore,
    rank: bracket.rank ?? null,
    totalPicks: TOTAL_PICKS,
    completedPicks: picks.length,
    championGolferId: bracket.championGolferId ?? null,
    championName,
    createdAt: bracket.createdAt.toISOString(),
    updatedAt: bracket.updatedAt.toISOString(),
  };
}

router.get("/brackets", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const brackets = await db
    .select()
    .from(bracketsTable)
    .where(eq(bracketsTable.userId, userId))
    .orderBy(asc(bracketsTable.createdAt));

  const result = await Promise.all(brackets.map(serializeBracket));
  res.json(result);
});

router.post("/brackets", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const parsed = CreateBracketBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Get active tournament
  const [tournament] = await db.select().from(tournamentsTable).orderBy(tournamentsTable.year).limit(1);
  if (!tournament) {
    res.status(400).json({ error: "No tournament found" });
    return;
  }

  const [bracket] = await db
    .insert(bracketsTable)
    .values({
      id: randomUUID(),
      userId,
      tournamentId: tournament.id,
      name: parsed.data.name,
      submitted: false,
      score: 0,
      maxPossibleScore: 127, // Max possible: 32*1 + 16*2 + 8*4 + 4*8 + 2*16 + 1*32 = 32+32+32+32+32+32 = 192... actually 1+2+4+8+16+32 * (matches per round)
      // Actually: 32*1 + 16*2 + 8*4 + 4*8 + 2*16 + 1*32 = 32+32+32+32+32+32 = 192
    })
    .returning();

  // Set initial max possible score
  await db.update(bracketsTable).set({ maxPossibleScore: 192 }).where(eq(bracketsTable.id, bracket.id));

  const result = await serializeBracket({ ...bracket, maxPossibleScore: 192 });
  res.status(201).json(result);
});

router.get("/brackets/:bracketId", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const params = GetBracketParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid bracket ID" });
    return;
  }

  const [bracket] = await db
    .select()
    .from(bracketsTable)
    .where(and(eq(bracketsTable.id, params.data.bracketId), eq(bracketsTable.userId, userId)));

  if (!bracket) {
    res.status(404).json({ error: "Bracket not found" });
    return;
  }

  const picks = await db
    .select()
    .from(bracketPicksTable)
    .where(eq(bracketPicksTable.bracketId, bracket.id))
    .orderBy(asc(bracketPicksTable.roundNumber));

  let championName: string | null = null;
  if (bracket.championGolferId) {
    const [champ] = await db.select().from(golfersTable).where(eq(golfersTable.id, bracket.championGolferId));
    championName = champ?.fullName ?? null;
  }

  res.json({
    id: bracket.id,
    userId: bracket.userId,
    tournamentId: bracket.tournamentId,
    name: bracket.name,
    submitted: bracket.submitted,
    submittedAt: bracket.submittedAt?.toISOString() ?? null,
    score: bracket.score,
    maxPossibleScore: bracket.maxPossibleScore,
    rank: bracket.rank ?? null,
    totalPicks: TOTAL_PICKS,
    completedPicks: picks.length,
    championGolferId: bracket.championGolferId ?? null,
    championName,
    picks: picks.map((p) => ({
      id: p.id,
      bracketId: p.bracketId,
      matchupId: p.matchupId,
      selectedGolferId: p.selectedGolferId,
      round: p.round,
      roundNumber: p.roundNumber,
      pointsPossible: p.pointsPossible,
      status: p.status,
      isCorrect: p.isCorrect ?? null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
    createdAt: bracket.createdAt.toISOString(),
    updatedAt: bracket.updatedAt.toISOString(),
  });
});

router.delete("/brackets/:bracketId", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const params = DeleteBracketParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid bracket ID" });
    return;
  }

  const [bracket] = await db
    .select()
    .from(bracketsTable)
    .where(and(eq(bracketsTable.id, params.data.bracketId), eq(bracketsTable.userId, userId)));

  if (!bracket) {
    res.status(404).json({ error: "Bracket not found" });
    return;
  }

  await db.delete(bracketsTable).where(eq(bracketsTable.id, bracket.id));
  res.json({ ok: true });
});

router.post("/brackets/:bracketId/submit", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const params = SubmitBracketParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid bracket ID" });
    return;
  }

  const [bracket] = await db
    .select()
    .from(bracketsTable)
    .where(and(eq(bracketsTable.id, params.data.bracketId), eq(bracketsTable.userId, userId)));

  if (!bracket) {
    res.status(404).json({ error: "Bracket not found" });
    return;
  }

  const picks = await db
    .select()
    .from(bracketPicksTable)
    .where(eq(bracketPicksTable.bracketId, bracket.id));

  const [updated] = await db
    .update(bracketsTable)
    .set({
      submitted: true,
      submittedAt: new Date(),
    })
    .where(eq(bracketsTable.id, bracket.id))
    .returning();

  const result = await serializeBracket(updated);
  res.json(result);
});

// --- Picks ---
router.get("/brackets/:bracketId/picks", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const raw = Array.isArray(req.params.bracketId) ? req.params.bracketId[0] : req.params.bracketId;
  const bracketId = raw;

  const [bracket] = await db
    .select()
    .from(bracketsTable)
    .where(and(eq(bracketsTable.id, bracketId), eq(bracketsTable.userId, userId)));

  if (!bracket) {
    res.status(404).json({ error: "Bracket not found" });
    return;
  }

  const picks = await db
    .select()
    .from(bracketPicksTable)
    .where(eq(bracketPicksTable.bracketId, bracketId))
    .orderBy(asc(bracketPicksTable.roundNumber));

  res.json(
    picks.map((p) => ({
      id: p.id,
      bracketId: p.bracketId,
      matchupId: p.matchupId,
      selectedGolferId: p.selectedGolferId,
      round: p.round,
      roundNumber: p.roundNumber,
      pointsPossible: p.pointsPossible,
      status: p.status,
      isCorrect: p.isCorrect ?? null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }))
  );
});

router.put("/brackets/:bracketId/picks", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const rawId = Array.isArray(req.params.bracketId) ? req.params.bracketId[0] : req.params.bracketId;
  const parsedParams = SavePickParams.safeParse({ bracketId: rawId });
  if (!parsedParams.success) {
    res.status(400).json({ error: "Invalid bracket ID" });
    return;
  }

  const parsed = SavePickBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const bracketId = parsedParams.data.bracketId;
  const { matchupId, selectedGolferId } = parsed.data;

  // Verify bracket ownership
  const [bracket] = await db
    .select()
    .from(bracketsTable)
    .where(and(eq(bracketsTable.id, bracketId), eq(bracketsTable.userId, userId)));

  if (!bracket) {
    res.status(404).json({ error: "Bracket not found" });
    return;
  }

  // Get the matchup
  const [matchup] = await db.select().from(matchupsTable).where(eq(matchupsTable.id, matchupId));
  if (!matchup) {
    res.status(404).json({ error: "Matchup not found" });
    return;
  }

  // Check if golfer is actually in this matchup.
  // For future-round placeholder matchups (golfers not yet determined), both
  // golferIds are null — in that case just verify the golfer exists in this tournament.
  const isPlaceholderMatchup = matchup.golfer1Id === null && matchup.golfer2Id === null;
  if (!isPlaceholderMatchup) {
    if (matchup.golfer1Id !== selectedGolferId && matchup.golfer2Id !== selectedGolferId) {
      res.status(400).json({ error: "Golfer is not in this matchup" });
      return;
    }
  } else {
    // Verify golfer is a real participant in this tournament
    const [golfer] = await db
      .select({ id: golfersTable.id })
      .from(golfersTable)
      .where(and(eq(golfersTable.id, selectedGolferId), eq(golfersTable.tournamentId, bracket.tournamentId)));
    if (!golfer) {
      res.status(400).json({ error: "Golfer is not in this tournament" });
      return;
    }
  }

  // Get all matchups for propagation logic
  const allMatchups = await db
    .select()
    .from(matchupsTable)
    .where(eq(matchupsTable.tournamentId, bracket.tournamentId));

  const matchupMap = new Map(allMatchups.map((m) => [m.id, m]));

  // Get existing picks
  const existingPicks = await db
    .select()
    .from(bracketPicksTable)
    .where(eq(bracketPicksTable.bracketId, bracketId));

  const picksByMatchup = new Map(existingPicks.map((p) => [p.matchupId, p]));

  // Check if the pick changed
  const existingPick = picksByMatchup.get(matchupId);
  const previousGolferId = existingPick?.selectedGolferId;

  if (previousGolferId === selectedGolferId) {
    // No change — return current picks
    res.json(
      existingPicks.map((p) => ({
        id: p.id,
        bracketId: p.bracketId,
        matchupId: p.matchupId,
        selectedGolferId: p.selectedGolferId,
        round: p.round,
        roundNumber: p.roundNumber,
        pointsPossible: p.pointsPossible,
        status: p.status,
        isCorrect: p.isCorrect ?? null,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      }))
    );
    return;
  }

  const points = ROUND_POINTS[matchup.round] ?? 1;

  // Upsert the current pick
  if (existingPick) {
    await db
      .update(bracketPicksTable)
      .set({
        selectedGolferId,
        status: "pending",
        isCorrect: null,
        pointsPossible: points,
      })
      .where(eq(bracketPicksTable.id, existingPick.id));
  } else {
    await db.insert(bracketPicksTable).values({
      id: randomUUID(),
      bracketId,
      matchupId,
      selectedGolferId,
      round: matchup.round,
      roundNumber: matchup.roundNumber,
      pointsPossible: points,
      status: "pending",
    });
  }

  // CASCADE: if the user changed their pick, clear downstream picks that
  // depended on the old golfer advancing (before lock only).
  if (previousGolferId && previousGolferId !== selectedGolferId) {
    const picksToDelete: string[] = [];

    // Walk the bracket tree forward from this matchup's next slot
    let currentMatchupId: string | null = matchup.nextMatchupId;
    let invalidGolferId = previousGolferId;

    while (currentMatchupId) {
      const nextMatchup = matchupMap.get(currentMatchupId);
      if (!nextMatchup) break;

      const downstreamPick = picksByMatchup.get(currentMatchupId);
      if (downstreamPick && downstreamPick.selectedGolferId === invalidGolferId) {
        picksToDelete.push(downstreamPick.id);
        invalidGolferId = downstreamPick.selectedGolferId; // continue chain
        currentMatchupId = nextMatchup.nextMatchupId;
      } else {
        break; // Chain broken — downstream pick is for a different golfer
      }
    }

    if (picksToDelete.length > 0) {
      for (const pickId of picksToDelete) {
        await db.delete(bracketPicksTable).where(eq(bracketPicksTable.id, pickId));
      }
    }
  }

  // Update champion if this is the final
  if (matchup.round === "F") {
    await db
      .update(bracketsTable)
      .set({ championGolferId: selectedGolferId })
      .where(eq(bracketsTable.id, bracketId));
  }

  // Return updated picks
  const updatedPicks = await db
    .select()
    .from(bracketPicksTable)
    .where(eq(bracketPicksTable.bracketId, bracketId))
    .orderBy(asc(bracketPicksTable.roundNumber));

  res.json(
    updatedPicks.map((p) => ({
      id: p.id,
      bracketId: p.bracketId,
      matchupId: p.matchupId,
      selectedGolferId: p.selectedGolferId,
      round: p.round,
      roundNumber: p.roundNumber,
      pointsPossible: p.pointsPossible,
      status: p.status,
      isCorrect: p.isCorrect ?? null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }))
  );
});

export default router;
