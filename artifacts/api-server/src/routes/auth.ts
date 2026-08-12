import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { LoginBody } from "@workspace/api-zod";
import { getSessionUserId, setSessionUserId, clearSession } from "../lib/session";
import { randomUUID } from "crypto";

const router: IRouter = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const name = parsed.data.name.trim();
  if (!name) {
    res.status(400).json({ error: "Name is required" });
    return;
  }

  // Find or create user by name (case-insensitive)
  let [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.name, name));

  if (!user) {
    [user] = await db
      .insert(usersTable)
      .values({ id: randomUUID(), name })
      .returning();
  }

  setSessionUserId(res, user.id);
  res.json({ user: { id: user.id, name: user.name, createdAt: user.createdAt.toISOString() } });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const userId = getSessionUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    clearSession(res);
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.json({ id: user.id, name: user.name, createdAt: user.createdAt.toISOString() });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  clearSession(res);
  res.json({ ok: true });
});

export default router;
