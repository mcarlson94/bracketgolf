import { Router, type IRouter } from "express";
import { db, tournamentsTable, golfersTable, matchupsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/tournament", async (_req, res): Promise<void> => {
  // Return the active tournament (by most recent year)
  const [tournament] = await db
    .select()
    .from(tournamentsTable)
    .orderBy(tournamentsTable.year)
    .limit(1);

  if (!tournament) {
    res.status(404).json({ error: "No tournament found" });
    return;
  }

  res.json({
    id: tournament.id,
    name: tournament.name,
    year: tournament.year,
    slug: tournament.slug,
    status: tournament.status,
    lockTime: tournament.lockTime?.toISOString() ?? null,
    sourceUrl: tournament.sourceUrl ?? null,
    lastSyncedAt: tournament.lastSyncedAt?.toISOString() ?? null,
    createdAt: tournament.createdAt.toISOString(),
    updatedAt: tournament.updatedAt.toISOString(),
  });
});

router.get("/tournament/golfers", async (_req, res): Promise<void> => {
  const [tournament] = await db
    .select()
    .from(tournamentsTable)
    .orderBy(tournamentsTable.year)
    .limit(1);

  if (!tournament) {
    res.json([]);
    return;
  }

  const golfers = await db
    .select()
    .from(golfersTable)
    .where(eq(golfersTable.tournamentId, tournament.id))
    .orderBy(asc(golfersTable.seed));

  res.json(
    golfers.map((g) => ({
      id: g.id,
      tournamentId: g.tournamentId,
      externalId: g.externalId ?? null,
      firstName: g.firstName ?? null,
      lastName: g.lastName ?? null,
      fullName: g.fullName,
      seed: g.seed,
      ranking: g.ranking ?? null,
      college: g.college ?? null,
      country: g.country ?? null,
      photoUrl: g.photoUrl ?? null,
      status: g.status,
      eliminated: g.eliminated,
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
    }))
  );
});

router.get("/tournament/matchups", async (_req, res): Promise<void> => {
  const [tournament] = await db
    .select()
    .from(tournamentsTable)
    .orderBy(tournamentsTable.year)
    .limit(1);

  if (!tournament) {
    res.json([]);
    return;
  }

  const matchups = await db
    .select()
    .from(matchupsTable)
    .where(eq(matchupsTable.tournamentId, tournament.id))
    .orderBy(asc(matchupsTable.roundNumber), asc(matchupsTable.position));

  // Fetch all golfers for population
  const golfers = await db
    .select()
    .from(golfersTable)
    .where(eq(golfersTable.tournamentId, tournament.id));

  const golferMap = new Map(golfers.map((g) => [g.id, g]));

  const formatGolfer = (id: string | null) => {
    if (!id) return null;
    const g = golferMap.get(id);
    if (!g) return null;
    return {
      id: g.id,
      tournamentId: g.tournamentId,
      externalId: g.externalId ?? null,
      firstName: g.firstName ?? null,
      lastName: g.lastName ?? null,
      fullName: g.fullName,
      seed: g.seed,
      ranking: g.ranking ?? null,
      college: g.college ?? null,
      country: g.country ?? null,
      photoUrl: g.photoUrl ?? null,
      status: g.status,
      eliminated: g.eliminated,
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
    };
  };

  res.json(
    matchups.map((m) => ({
      id: m.id,
      tournamentId: m.tournamentId,
      externalId: m.externalId ?? null,
      round: m.round,
      roundNumber: m.roundNumber,
      position: m.position,
      golfer1Id: m.golfer1Id ?? null,
      golfer2Id: m.golfer2Id ?? null,
      winnerId: m.winnerId ?? null,
      nextMatchupId: m.nextMatchupId ?? null,
      nextSlot: m.nextSlot ?? null,
      matchScore: m.matchScore ?? null,
      status: m.status,
      sourceUpdatedAt: m.sourceUpdatedAt?.toISOString() ?? null,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
      golfer1: formatGolfer(m.golfer1Id),
      golfer2: formatGolfer(m.golfer2Id),
      winner: formatGolfer(m.winnerId),
    }))
  );
});

export default router;
