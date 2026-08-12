import { MatchupRound } from "@workspace/api-client-react";

export const SCORING_SYSTEM = {
  [MatchupRound.R64]: 1,
  [MatchupRound.R32]: 2,
  [MatchupRound.R16]: 4,
  [MatchupRound.QF]: 8,
  [MatchupRound.SF]: 16,
  [MatchupRound.F]: 32,
};

export const ROUND_DISPLAY_NAMES = {
  [MatchupRound.R64]: "Round of 64",
  [MatchupRound.R32]: "Round of 32",
  [MatchupRound.R16]: "Round of 16",
  [MatchupRound.QF]: "Quarterfinals",
  [MatchupRound.SF]: "Semifinals",
  [MatchupRound.F]: "Championship",
};

export const ROUND_ORDER = [
  MatchupRound.R64,
  MatchupRound.R32,
  MatchupRound.R16,
  MatchupRound.QF,
  MatchupRound.SF,
  MatchupRound.F,
];
