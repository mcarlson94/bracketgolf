import { pgTable, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tournamentsTable } from "./tournaments";

export const golfersTable = pgTable("golfers", {
  id: text("id").primaryKey(),
  tournamentId: text("tournament_id").notNull().references(() => tournamentsTable.id),
  externalId: text("external_id"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  fullName: text("full_name").notNull(),
  seed: integer("seed").notNull(),
  ranking: integer("ranking"),
  college: text("college"),
  country: text("country"),
  photoUrl: text("photo_url"),
  status: text("status").notNull().default("active"),
  eliminated: boolean("eliminated").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertGolferSchema = createInsertSchema(golfersTable).omit({ createdAt: true, updatedAt: true });
export type InsertGolfer = z.infer<typeof insertGolferSchema>;
export type Golfer = typeof golfersTable.$inferSelect;
