import { Router, type IRouter } from "express";
import { db, groupsTable, groupMembersTable, usersTable, bracketsTable, tournamentsTable, golfersTable } from "@workspace/db";
import { eq, and, desc, asc } from "drizzle-orm";
import { CreateGroupBody, JoinGroupBody, GetGroupParams } from "@workspace/api-zod";
import { getSessionUserId } from "../lib/session";
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

function generateJoinCode(name: string): string {
  const base = name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6).padEnd(4, "X");
  const suffix = Math.floor(Math.random() * 100).toString().padStart(2, "0");
  return base + suffix;
}

router.get("/groups", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const memberships = await db
    .select()
    .from(groupMembersTable)
    .where(eq(groupMembersTable.userId, userId));

  const groups: typeof groupsTable.$inferSelect[] = [];
  for (const m of memberships) {
    const [g] = await db.select().from(groupsTable).where(eq(groupsTable.id, m.groupId));
    if (g) groups.push(g);
  }

  const result = await Promise.all(
    groups.map(async (g) => {
      const members = await db.select().from(groupMembersTable).where(eq(groupMembersTable.groupId, g.id));
      return {
        id: g.id,
        tournamentId: g.tournamentId,
        name: g.name,
        description: g.description ?? null,
        joinCode: g.joinCode,
        createdByUserId: g.createdByUserId,
        memberCount: members.length,
        createdAt: g.createdAt.toISOString(),
      };
    })
  );

  res.json(result);
});

router.post("/groups", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const parsed = CreateGroupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [tournament] = await db.select().from(tournamentsTable).orderBy(tournamentsTable.year).limit(1);
  if (!tournament) {
    res.status(400).json({ error: "No tournament found" });
    return;
  }

  const joinCode = generateJoinCode(parsed.data.name);
  const [group] = await db
    .insert(groupsTable)
    .values({
      id: randomUUID(),
      tournamentId: tournament.id,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      joinCode,
      createdByUserId: userId,
    })
    .returning();

  // Auto-join creator
  await db.insert(groupMembersTable).values({
    id: randomUUID(),
    groupId: group.id,
    userId,
  });

  res.status(201).json({
    id: group.id,
    tournamentId: group.tournamentId,
    name: group.name,
    description: group.description ?? null,
    joinCode: group.joinCode,
    createdByUserId: group.createdByUserId,
    memberCount: 1,
    createdAt: group.createdAt.toISOString(),
  });
});

router.post("/groups/join", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const parsed = JoinGroupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [group] = await db
    .select()
    .from(groupsTable)
    .where(eq(groupsTable.joinCode, parsed.data.joinCode.toUpperCase()));

  if (!group) {
    res.status(404).json({ error: "Group not found. Check the join code." });
    return;
  }

  // Check if already a member
  const [existing] = await db
    .select()
    .from(groupMembersTable)
    .where(and(eq(groupMembersTable.groupId, group.id), eq(groupMembersTable.userId, userId)));

  if (!existing) {
    await db.insert(groupMembersTable).values({
      id: randomUUID(),
      groupId: group.id,
      userId,
    });
  }

  const members = await db.select().from(groupMembersTable).where(eq(groupMembersTable.groupId, group.id));

  res.json({
    id: group.id,
    tournamentId: group.tournamentId,
    name: group.name,
    description: group.description ?? null,
    joinCode: group.joinCode,
    createdByUserId: group.createdByUserId,
    memberCount: members.length,
    createdAt: group.createdAt.toISOString(),
  });
});

router.get("/groups/:groupId", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const params = GetGroupParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid group ID" });
    return;
  }

  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, params.data.groupId));
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  const memberRecords = await db.select().from(groupMembersTable).where(eq(groupMembersTable.groupId, group.id));
  const memberUserIds = memberRecords.map((m) => m.userId);

  const members: { id: string; name: string; createdAt: string }[] = [];
  for (const mid of memberUserIds) {
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, mid));
    if (u) members.push({ id: u.id, name: u.name, createdAt: u.createdAt.toISOString() });
  }

  // Group leaderboard: submitted brackets from members
  const brackets = await db
    .select()
    .from(bracketsTable)
    .where(and(eq(bracketsTable.tournamentId, group.tournamentId), eq(bracketsTable.submitted, true)));

  const memberBrackets = brackets.filter((b) => memberUserIds.includes(b.userId));
  const sorted = memberBrackets.sort((a, b) => b.score - a.score || b.maxPossibleScore - a.maxPossibleScore);

  const champMap = new Map<string, string>();
  for (const b of sorted) {
    if (b.championGolferId && !champMap.has(b.championGolferId)) {
      const [g] = await db.select().from(golfersTable).where(eq(golfersTable.id, b.championGolferId));
      if (g) champMap.set(g.id, g.fullName);
    }
  }

  const leaderboard = sorted.map((b, i) => {
    const user = members.find((m) => m.id === b.userId);
    return {
      rank: i + 1,
      bracketId: b.id,
      bracketName: b.name,
      userId: b.userId,
      userName: user?.name ?? "Unknown",
      score: b.score,
      maxPossibleScore: b.maxPossibleScore,
      championName: b.championGolferId ? (champMap.get(b.championGolferId) ?? null) : null,
    };
  });

  res.json({
    id: group.id,
    tournamentId: group.tournamentId,
    name: group.name,
    description: group.description ?? null,
    joinCode: group.joinCode,
    createdByUserId: group.createdByUserId,
    memberCount: members.length,
    members,
    leaderboard,
    createdAt: group.createdAt.toISOString(),
  });
});

export default router;
