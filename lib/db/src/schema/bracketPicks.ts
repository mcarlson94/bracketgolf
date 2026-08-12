import { pgTable, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { bracketsTable } from "./brackets";
import { matchupsTable } from "./matchups";
import { golfersTable } from "./golfers";

export const bracketPicksTable = pgTable("bracket_picks", {
  id: text("id").primaryKey(),
  bracketId: text("bracket_id").notNull().references(() => bracketsTable.id, { onDelete: "cascade" }),
  matchupId: text("matchup_id").notNull().references(() => matchupsTable.id),
  selectedGolferId: text("selected_golfer_id").notNull().references(() => golfersTable.id),
  round: text("round").notNull(), // R64 | R32 | R16 | QF | SF | F
  roundNumber: integer("round_number").notNull(),
  pointsPossible: integer("points_possible").notNull().default(1),
  status: text("status").notNull().default("pending"), // pending | correct | incorrect | eliminated
  isCorrect: boolean("is_correct"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBracketPickSchema = createInsertSchema(bracketPicksTable).omit({ createdAt: true, updatedAt: true });
export type InsertBracketPick = z.infer<typeof insertBracketPickSchema>;
export type BracketPick = typeof bracketPicksTable.$inferSelect;
