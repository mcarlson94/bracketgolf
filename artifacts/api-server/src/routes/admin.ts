import { Router, type IRouter } from "express";
import { db, tournamentsTable, matchupsTable, golfersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { AdminImportBody, AdminUpdateTournamentBody, AdminUpdateMatchupBody, AdminUpdateMatchupParams } from "@workspace/api-zod";
import { importUSGAData } from "../lib/usga-importer";
import { rescoreAllBrackets } from "../lib/scoring-service";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post("/admin/import", async (req, res): Promise<void> => {
  const parsed = AdminImportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    req.log.info({ action: parsed.data.action }, "Admin import started");
    const result = await importUSGAData(parsed.data.action);

    res.json({
      success: true,
      message: `Import complete. ${result.golfersImported} golfers, ${result.matchupsImported} matchups imported, ${result.resultsUpdated} results updated.`,
      golfersImported: result.golfersImported,
      matchupsImported: result.matchupsImported,
      resultsUpdated: result.resultsUpdated,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Import failed");
    res.status(500).json({
      success: false,
      message: `Import failed: ${String(err)}`,
      golfersImported: null,
      matchupsImported: null,
      resultsUpdated: null,
      errors: [String(err)],
      timestamp: new Date().toISOString(),
    });
  }
});

router.patch("/admin/tournament", async (req, res): Promise<void> => {
  const parsed = AdminUpdateTournamentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [tournament] = await db.select().from(tournamentsTable).orderBy(tournamentsTable.year).limit(1);
  if (!tournament) {
    res.status(404).json({ error: "No tournament found" });
    return;
  }

  const updates: Partial<typeof tournamentsTable.$inferInsert> = {};
  if (parsed.data.lockTime !== undefined) {
    updates.lockTime = parsed.data.lockTime ? new Date(parsed.data.lockTime) : null;
  }
  if (parsed.data.status !== undefined) {
    updates.status = parsed.data.status;
  }

  const [updated] = await db
    .update(tournamentsTable)
    .set(updates)
    .where(eq(tournamentsTable.id, tournament.id))
    .returning();

  res.json({
    id: updated.id,
    name: updated.name,
    year: updated.year,
    slug: updated.slug,
    status: updated.status,
    lockTime: updated.lockTime?.toISOString() ?? null,
    sourceUrl: updated.sourceUrl ?? null,
    lastSyncedAt: updated.lastSyncedAt?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
});

router.patch("/admin/matchups/:matchupId", async (req, res): Promise<void> => {
  const params = AdminUpdateMatchupParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid matchup ID" });
    return;
  }

  const parsed = AdminUpdateMatchupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [matchup] = await db.select().from(matchupsTable).where(eq(matchupsTable.id, params.data.matchupId));
  if (!matchup) {
    res.status(404).json({ error: "Matchup not found" });
    return;
  }

  const updates: Partial<typeof matchupsTable.$inferInsert> = {};
  if (parsed.data.winnerId !== undefined) updates.winnerId = parsed.data.winnerId;
  if (parsed.data.matchScore !== undefined) updates.matchScore = parsed.data.matchScore;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;

  const [updated] = await db
    .update(matchupsTable)
    .set(updates)
    .where(eq(matchupsTable.id, params.data.matchupId))
    .returning();

  // Populate golfer data for response
  const formatGolfer = async (id: string | null) => {
    if (!id) return null;
    const [g] = await db.select().from(golfersTable).where(eq(golfersTable.id, id));
    if (!g) return null;
    return {
      id: g.id, tournamentId: g.tournamentId, externalId: g.externalId ?? null,
      firstName: g.firstName ?? null, lastName: g.lastName ?? null, fullName: g.fullName,
      seed: g.seed, ranking: g.ranking ?? null, college: g.college ?? null,
      country: g.country ?? null, photoUrl: g.photoUrl ?? null, status: g.status,
      eliminated: g.eliminated, createdAt: g.createdAt.toISOString(), updatedAt: g.updatedAt.toISOString(),
    };
  };

  res.json({
    id: updated.id,
    tournamentId: updated.tournamentId,
    externalId: updated.externalId ?? null,
    round: updated.round,
    roundNumber: updated.roundNumber,
    position: updated.position,
    golfer1Id: updated.golfer1Id ?? null,
    golfer2Id: updated.golfer2Id ?? null,
    winnerId: updated.winnerId ?? null,
    nextMatchupId: updated.nextMatchupId ?? null,
    nextSlot: updated.nextSlot ?? null,
    matchScore: updated.matchScore ?? null,
    status: updated.status,
    sourceUpdatedAt: updated.sourceUpdatedAt?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
    golfer1: await formatGolfer(updated.golfer1Id),
    golfer2: await formatGolfer(updated.golfer2Id),
    winner: await formatGolfer(updated.winnerId),
  });

  // Trigger rescore in background
  rescoreAllBrackets(matchup.tournamentId).catch((err) =>
    logger.error({ err }, "Background rescore failed")
  );
});

router.post("/admin/rescore", async (req, res): Promise<void> => {
  const [tournament] = await db.select().from(tournamentsTable).orderBy(tournamentsTable.year).limit(1);
  if (!tournament) {
    res.status(404).json({ error: "No tournament found" });
    return;
  }

  try {
    const count = await rescoreAllBrackets(tournament.id);
    res.json({ success: true, bracketsRescored: count, message: `Rescored ${count} brackets` });
  } catch (err) {
    req.log.error({ err }, "Rescore failed");
    res.status(500).json({ success: false, bracketsRescored: 0, message: String(err) });
  }
});

export default router;
