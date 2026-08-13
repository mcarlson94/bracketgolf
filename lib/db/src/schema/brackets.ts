import { pgTable, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { tournamentsTable } from "./tournaments";
import { golfersTable } from "./golfers";

export const bracketsTable = pgTable("brackets", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id),
  tournamentId: text("tournament_id").notNull().references(() => tournamentsTable.id),
  name: text("name").notNull(),
  submitted: boolean("submitted").notNull().default(false),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  score: integer("score").notNull().default(0),
  maxPossibleScore: integer("max_possible_score").notNull().default(0),
  rank: integer("rank"),
  startRound: text("start_round").notNull().default("R64"),
  championGolferId: text("champion_golfer_id").references(() => golfersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBracketSchema = createInsertSchema(bracketsTable).omit({ createdAt: true, updatedAt: true });
export type InsertBracket = z.infer<typeof insertBracketSchema>;
export type Bracket = typeof bracketsTable.$inferSelect;
