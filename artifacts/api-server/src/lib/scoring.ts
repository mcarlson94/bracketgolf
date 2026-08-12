/**
 * Centralized scoring configuration for Bracket Golf.
 * Change values here to update scoring across the entire app.
 */
export const ROUND_POINTS: Record<string, number> = {
  R64: 1,
  R32: 2,
  R16: 4,
  QF: 8,
  SF: 16,
  F: 32,
};

export const ROUND_ORDER = ["R64", "R32", "R16", "QF", "SF", "F"] as const;
export type Round = (typeof ROUND_ORDER)[number];

export const ROUND_DISPLAY: Record<string, string> = {
  R64: "Round of 64",
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarterfinals",
  SF: "Semifinals",
  F: "Championship",
};

export const TOTAL_PICKS = 63;

export function getPointsForRound(round: string): number {
  return ROUND_POINTS[round] ?? 1;
}

export function getMaxPossibleScore(
  picks: Array<{ round: string; status: string }>
): number {
  let max = 0;
  for (const pick of picks) {
    if (pick.status !== "incorrect" && pick.status !== "eliminated") {
      max += getPointsForRound(pick.round);
    }
  }
  return max;
}
