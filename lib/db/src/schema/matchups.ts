import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tournamentsTable } from "./tournaments";
import { golfersTable } from "./golfers";

export const matchupsTable = pgTable("matchups", {
  id: text("id").primaryKey(), // stable: 2026-us-am-r64-01
  tournamentId: text("tournament_id").notNull().references(() => tournamentsTable.id),
  externalId: text("external_id"),
  round: text("round").notNull(), // R64 | R32 | R16 | QF | SF | F
  roundNumber: integer("round_number").notNull(), // 1-6
  position: integer("position").notNull(), // position within round
  golfer1Id: text("golfer1_id").references(() => golfersTable.id),
  golfer2Id: text("golfer2_id").references(() => golfersTable.id),
  winnerId: text("winner_id").references(() => golfersTable.id),
  nextMatchupId: text("next_matchup_id"), // no FK to self to avoid circular dependency issues
  nextSlot: integer("next_slot"), // 1 or 2 (which slot in the next matchup)
  matchScore: text("match_score"), // e.g. "3 & 2", "1 UP"
  status: text("status").notNull().default("scheduled"), // scheduled | live | completed
  sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertMatchupSchema = createInsertSchema(matchupsTable).omit({ createdAt: true, updatedAt: true });
export type InsertMatchup = z.infer<typeof insertMatchupSchema>;
export type Matchup = typeof matchupsTable.$inferSelect;
