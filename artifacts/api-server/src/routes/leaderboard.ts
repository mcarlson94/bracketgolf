import { Router, type IRouter } from "express";
import { db, bracketsTable, usersTable, golfersTable, tournamentsTable } from "@workspace/db";
import { eq, desc, and, asc } from "drizzle-orm";
import { getSessionUserId } from "../lib/session";

const router: IRouter = Router();

router.get("/leaderboard", async (req, res): Promise<void> => {
  const userId = getSessionUserId(req);
  const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
  const limit = Math.min(100, Math.max(10, parseInt(String(req.query.limit || "50"), 10)));
  const offset = (page - 1) * limit;

  // Get active tournament
  const [tournament] = await db.select().from(tournamentsTable).orderBy(tournamentsTable.year).limit(1);
  if (!tournament) {
    res.json({ entries: [], total: 0, currentUserRank: null });
    return;
  }

  // Get all submitted brackets ordered by score
  const allBrackets = await db
    .select()
    .from(bracketsTable)
    .where(and(eq(bracketsTable.tournamentId, tournament.id), eq(bracketsTable.submitted, true)))
    .orderBy(desc(bracketsTable.score), desc(bracketsTable.maxPossibleScore), asc(bracketsTable.createdAt));

  const total = allBrackets.length;

  // Find current user's rank
  let currentUserRank: number | null = null;
  if (userId) {
    const userIdx = allBrackets.findIndex((b) => b.userId === userId);
    if (userIdx >= 0) currentUserRank = userIdx + 1;
  }

  const pageBrackets = allBrackets.slice(offset, offset + limit);

  // Fetch users and champions for display
  const userIds = [...new Set(pageBrackets.map((b) => b.userId))];
  const championIds = [...new Set(pageBrackets.map((b) => b.championGolferId).filter(Boolean) as string[])];

  const users = await db.select().from(usersTable).where(
    userIds.length > 0 ? eq(usersTable.id, userIds[0]) : eq(usersTable.id, "noop")
  );
  // Bulk fetch users
  const userMap = new Map<string, string>();
  for (const uid of userIds) {
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, uid));
    if (u) userMap.set(u.id, u.name);
  }

  const champMap = new Map<string, string>();
  for (const cid of championIds) {
    const [g] = await db.select().from(golfersTable).where(eq(golfersTable.id, cid));
    if (g) champMap.set(g.id, g.fullName);
  }

  const entries = pageBrackets.map((b, i) => ({
    rank: offset + i + 1,
    bracketId: b.id,
    bracketName: b.name,
    userId: b.userId,
    userName: userMap.get(b.userId) ?? "Unknown",
    score: b.score,
    maxPossibleScore: b.maxPossibleScore,
    championName: b.championGolferId ? (champMap.get(b.championGolferId) ?? null) : null,
  }));

  res.json({ entries, total, currentUserRank });
});

export default router;
