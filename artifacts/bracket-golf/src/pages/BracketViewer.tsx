import { useState, useCallback, useMemo, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import {
  useGetBracket,
  useGetMatchups,
  useSavePick,
  useSubmitBracket,
  useGetTournament,
  MatchupRound,
  BracketPickStatus
} from "@workspace/api-client-react";
import { getGetBracketQueryKey } from "@workspace/api-client-react";
import { BracketMatchupCard, ChampionshipCard } from "@/components/bracket/BracketMatchup";
import { ResultMatchupCard } from "@/components/bracket/ResultMatchupCard";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { ROUND_DISPLAY_NAMES, ROUND_ORDER } from "@/lib/constants";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export default function BracketViewer() {
  const params = useParams();
  const bracketId = params.id as string;
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<MatchupRound>(MatchupRound.R64);
  const [pendingMatchups, setPendingMatchups] = useState<Record<string, boolean>>({});
  const [tabInitialized, setTabInitialized] = useState(false);

  const { data: tournament, isLoading: loadingTournament } = useGetTournament();
  const { data: bracketData, isLoading: loadingBracket, error: bracketError } =
    useGetBracket(bracketId, { query: { enabled: !!bracketId, retry: false } });
  const { data: matchups, isLoading: loadingMatchups } = useGetMatchups();

  const savePickMutation = useSavePick();
  const submitBracketMutation = useSubmitBracket();

  const isLocked = tournament?.status === "locked" || tournament?.status === "completed";
  const bracket = bracketData;
  const picks = bracketData?.picks || [];

  // Initialize tab to R32 for R32 brackets (once bracket data loads)
  useEffect(() => {
    if (bracket && !tabInitialized) {
      if ((bracket as any).startRound === "R32") {
        setActiveTab(MatchupRound.R32);
      }
      setTabInitialized(true);
    }
  }, [bracket, tabInitialized]);

  const handlePick = useCallback(
    (matchupId: string, golferId: string) => {
      if (isLocked || !bracket) return;
      setPendingMatchups((prev) => ({ ...prev, [matchupId]: true }));
      savePickMutation.mutate(
        { bracketId, data: { matchupId, selectedGolferId: golferId } },
        {
          onSuccess: (updatedPicks) => {
            queryClient.setQueryData(getGetBracketQueryKey(bracketId), (old: any) => {
              if (!old) return old;
              const newCompleted = updatedPicks.filter((p: any) => p.selectedGolferId).length;
              const finalPick = updatedPicks.find((p: any) => p.round === MatchupRound.F);
              let champId = null;
              let champName = null;
              if (finalPick) {
                champId = finalPick.selectedGolferId;
                const m = matchups?.find((m) => m.id === finalPick.matchupId);
                if (m?.golfer1?.id === champId) champName = m.golfer1.fullName;
                if (m?.golfer2?.id === champId) champName = m.golfer2.fullName;
              }
              return { ...old, picks: updatedPicks, completedPicks: newCompleted, championGolferId: champId, championName: champName };
            });
          },
          onError: () => {
            toast({ title: "Error saving pick", description: "Please try again.", variant: "destructive" });
          },
          onSettled: () => {
            setPendingMatchups((prev) => {
              const s = { ...prev };
              delete s[matchupId];
              return s;
            });
          },
        }
      );
    },
    [bracketId, isLocked, bracket, savePickMutation, queryClient, matchups]
  );

  const handleSubmit = () => {
    if (!bracket || bracket.completedPicks < bracket.totalPicks) return;
    submitBracketMutation.mutate(
      { bracketId },
      {
        onSuccess: (updatedBracket) => {
          toast({ title: "Bracket Submitted!", description: "Good luck in the tournament!" });
          queryClient.setQueryData(getGetBracketQueryKey(bracketId), (old: any) =>
            old ? { ...old, submitted: true, submittedAt: updatedBracket.submittedAt } : old
          );
        },
        onError: (err: any) => {
          toast({ title: "Submission failed", description: err?.message || "There was an error submitting your bracket.", variant: "destructive" });
        },
      }
    );
  };

  const matchupsByRound = useMemo(() => {
    const grouped = {} as Record<MatchupRound, typeof matchups>;
    ROUND_ORDER.forEach((r) => (grouped[r] = []));
    if (matchups) {
      matchups.forEach((m) => {
        if (grouped[m.round]) grouped[m.round].push(m);
      });
      Object.keys(grouped).forEach((k) => {
        const round = k as MatchupRound;
        grouped[round].sort((a, b) => a.position - b.position);
      });
    }
    return grouped;
  }, [matchups]);

  /**
   * ESPN Tournament Challenge–style pick propagation.
   *
   * Processes rounds bottom-up (R64 → R32 → … → F).
   * For each matchup whose real golfers are TBD, we look at which earlier
   * matchup feeds into that slot and use whichever golfer the user picked
   * as the projected participant. The projected winner of each matchup is
   * either the real tournament winner (if the match is done) or whoever
   * the user chose among the projected field.
   */
  const { projectedGolfer1Map, projectedGolfer2Map } = useMemo(() => {
    if (!matchups) return { projectedGolfer1Map: new Map(), projectedGolfer2Map: new Map() };

    // Reverse-lookup: feedingFor[targetMatchupId][slot] = sourceMatchupId
    const feedingFor: Record<string, { 1?: string; 2?: string }> = {};
    matchups.forEach((m) => {
      if (m.nextMatchupId && m.nextSlot) {
        if (!feedingFor[m.nextMatchupId]) feedingFor[m.nextMatchupId] = {};
        (feedingFor[m.nextMatchupId] as Record<number, string>)[m.nextSlot] = m.id;
      }
    });

    const matchupById = new Map(matchups.map((m) => [m.id, m]));
    const pickByMatchupId = new Map(picks.map((p) => [p.matchupId, p.selectedGolferId]));

    // projected winner per matchup (null = not yet determined)
    const projectedWinner = new Map<string, typeof matchups[0]["golfer1"]>();
    const g1Map = new Map<string, typeof matchups[0]["golfer1"]>();
    const g2Map = new Map<string, typeof matchups[0]["golfer1"]>();

    ROUND_ORDER.forEach((round) => {
      (matchupsByRound[round] ?? []).forEach((matchup) => {
        // Slot 1 — real golfer wins over projected
        let pg1 = matchup.golfer1 ?? null;
        if (!pg1) {
          const srcId = feedingFor[matchup.id]?.[1];
          if (srcId) pg1 = projectedWinner.get(srcId) ?? null;
        }

        // Slot 2
        let pg2 = matchup.golfer2 ?? null;
        if (!pg2) {
          const srcId = feedingFor[matchup.id]?.[2];
          if (srcId) pg2 = projectedWinner.get(srcId) ?? null;
        }

        g1Map.set(matchup.id, pg1);
        g2Map.set(matchup.id, pg2);

        // Determine projected winner for this matchup
        // Real tournament result takes priority over user pick
        if (matchup.winner) {
          projectedWinner.set(matchup.id, matchup.winner);
        } else {
          const pickedId = pickByMatchupId.get(matchup.id);
          if (pickedId) {
            const winner = [pg1, pg2].find((g) => g?.id === pickedId) ?? null;
            projectedWinner.set(matchup.id, winner);
          }
        }
      });
    });

    return { projectedGolfer1Map: g1Map, projectedGolfer2Map: g2Map };
  }, [matchups, picks, matchupsByRound]);

  // Pick counts per round — for the bottom nav badge
  const pickCountByRound = useMemo(() => {
    const counts = {} as Record<MatchupRound, { done: number; total: number }>;
    ROUND_ORDER.forEach((r) => {
      const rMatchups = matchupsByRound[r] ?? [];
      const done = picks.filter((p) => p.round === r && p.selectedGolferId).length;
      counts[r] = { done, total: rMatchups.length };
    });
    return counts;
  }, [matchupsByRound, picks]);

  const activeRoundIndex = ROUND_ORDER.indexOf(activeTab);
  const canGoBack = activeRoundIndex > 0;
  const canGoForward = activeRoundIndex < ROUND_ORDER.length - 1;

  if (loadingBracket || loadingMatchups || loadingTournament) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm font-medium">Loading bracket...</p>
        </div>
      </div>
    );
  }

  if (bracketError || !bracket) {
    return (
      <div className="max-w-3xl mx-auto mt-20 text-center space-y-6 px-4">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
        <h2 className="text-2xl font-bold">Bracket Not Found</h2>
        <p className="text-muted-foreground text-sm">The bracket you're looking for doesn't exist or you don't have access.</p>
        <Button onClick={() => setLocation("/dashboard")} className="rounded-sm">Return to Dashboard</Button>
      </div>
    );
  }

  const startRound = (bracket as any).startRound ?? "R64";
  const isR32Bracket = startRound === "R32";
  const isComplete = bracket.completedPicks >= bracket.totalPicks;
  const isSaving = Object.keys(pendingMatchups).length > 0;

  const finalMatchup = matchupsByRound[MatchupRound.F]?.[0];
  const finalPick = picks.find((p) => p.round === MatchupRound.F);
  let championGolfer = undefined;
  if (finalPick?.selectedGolferId && finalMatchup) {
    // Check real golfers first, then projected
    const pg1 = finalMatchup.golfer1 ?? projectedGolfer1Map.get(finalMatchup.id) ?? null;
    const pg2 = finalMatchup.golfer2 ?? projectedGolfer2Map.get(finalMatchup.id) ?? null;
    if (pg1?.id === finalPick.selectedGolferId) championGolfer = pg1;
    else if (pg2?.id === finalPick.selectedGolferId) championGolfer = pg2;
  }

  const currentRoundMatchups = matchupsByRound[activeTab] ?? [];
  const previousRound = activeRoundIndex > 0 ? ROUND_ORDER[activeRoundIndex - 1] : null;
  const prevRoundPicks = previousRound
    ? pickCountByRound[previousRound]
    : null;
  const roundIsEmpty = currentRoundMatchups.length === 0;

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] bg-gray-50">

      {/* ── Sticky header ────────────────────────────────── */}
      <div className="bg-white border-b sticky top-[88px] z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Left: back + title */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setLocation("/dashboard")}
                className="shrink-0 hidden sm:flex items-center justify-center w-8 h-8 rounded-sm border border-border text-muted-foreground hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="min-w-0">
                <h1 className="text-base font-bold leading-tight truncate">{bracket.name}</h1>
                <div className="flex items-center gap-2 text-xs mt-0.5 text-muted-foreground">
                  <span>{tournament?.name}</span>
                  <span>·</span>
                  <span className="font-semibold text-primary">{bracket.score} pts</span>
                </div>
              </div>
            </div>

            {/* Right: save status + submit */}
            <div className="flex items-center gap-4 shrink-0">
              <div className="hidden sm:block text-right">
                <div className="text-xs font-medium flex items-center justify-end gap-1.5 mb-1">
                  {isSaving ? (
                    <span className="flex items-center text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin mr-1" /> Saving…
                    </span>
                  ) : (
                    <span className="flex items-center text-green-700">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Saved
                    </span>
                  )}
                  <span className="text-muted-foreground">{bracket.completedPicks}/{bracket.totalPicks}</span>
                </div>
                <Progress value={(bracket.completedPicks / bracket.totalPicks) * 100} className="h-1 w-40" />
              </div>

              {!isLocked && !bracket.submitted && isComplete && (
                <Button
                  onClick={handleSubmit}
                  disabled={submitBracketMutation.isPending}
                  className="rounded-sm font-semibold text-sm h-9 px-4"
                >
                  Submit Bracket
                </Button>
              )}
              {!isLocked && bracket.submitted && (
                <div className="px-3 py-1.5 bg-green-50 text-green-800 border border-green-200 rounded-sm text-xs font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Submitted
                </div>
              )}
              {isLocked && (
                <div className="px-3 py-1.5 bg-secondary text-secondary-foreground rounded-sm text-xs font-semibold">
                  Picks Locked
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main content area ─────────────────────────────── */}
      <div className="flex-1 w-full overflow-hidden flex flex-col">

        {/* ── MOBILE view ──────────────────────────────────── */}
        <div className="lg:hidden flex flex-col flex-1 overflow-hidden">
          {/* Scrollable content — padded at bottom for the sticky footer */}
          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-44">
            {/* Round heading */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-6 h-px bg-primary" />
              <h2 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">
                {ROUND_DISPLAY_NAMES[activeTab]}
              </h2>
            </div>

            {/* Championship card at top when on final round */}
            {activeTab === MatchupRound.F && championGolfer && (
              <div className="mb-6">
                <ChampionshipCard golfer={championGolfer} isLocked={isLocked} />
              </div>
            )}

            {/* Hint banner when projected golfers aren't available yet for this round */}
            {!roundIsEmpty && previousRound && prevRoundPicks && prevRoundPicks.done < prevRoundPicks.total && (
              <div className="mb-4 px-3 py-2.5 bg-amber-50 border border-amber-200 flex items-center justify-between gap-3 max-w-sm mx-auto">
                <p className="text-xs text-amber-800">
                  Pick your <strong>{ROUND_DISPLAY_NAMES[previousRound]}</strong> winners to see who advances here.
                </p>
                <button
                  onClick={() => setActiveTab(previousRound)}
                  className="text-xs font-semibold text-amber-700 underline underline-offset-2 whitespace-nowrap shrink-0"
                >
                  Go back
                </button>
              </div>
            )}

            {roundIsEmpty ? (
              <div className="text-center py-16 px-6 border border-dashed border-border bg-white max-w-sm mx-auto">
                <p className="font-semibold text-sm mb-1">No matchups yet</p>
                <p className="text-xs text-muted-foreground">This round hasn't been drawn yet.</p>
              </div>
            ) : isR32Bracket && activeTab === MatchupRound.R64 ? (
              /* R32 bracket: show R64 as read-only results */
              <div className="space-y-2 mb-4 max-w-sm mx-auto">
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest mb-3">
                  Round of 64 Results
                </p>
                {currentRoundMatchups.map((matchup) => (
                  <ResultMatchupCard key={matchup.id} matchup={matchup} />
                ))}
              </div>
            ) : (
              <div className="grid gap-3 max-w-sm mx-auto">
                {currentRoundMatchups.map((matchup) => (
                  <BracketMatchupCard
                    key={matchup.id}
                    matchup={matchup}
                    pick={picks.find((p) => p.matchupId === matchup.id)}
                    isLocked={isLocked}
                    onPickGolfer={handlePick}
                    isLoading={pendingMatchups[matchup.id]}
                    projectedGolfer1={projectedGolfer1Map.get(matchup.id)}
                    projectedGolfer2={projectedGolfer2Map.get(matchup.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Sticky bottom footer ─────────────────────────── */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-[0_-2px_12px_rgba(0,0,0,0.08)] z-50">
            {/* Round navigator tabs */}
            <div className="flex items-center border-b border-border">
              {/* Prev arrow */}
              <button
                disabled={!canGoBack}
                onClick={() => canGoBack && setActiveTab(ROUND_ORDER[activeRoundIndex - 1])}
                className="flex-shrink-0 px-3 h-10 flex items-center justify-center text-muted-foreground disabled:opacity-20 hover:text-foreground transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Round tabs */}
              <div className="flex flex-1 overflow-x-auto scrollbar-none">
                {ROUND_ORDER.map((round) => {
                  const isActive = round === activeTab;
                  const { done, total } = pickCountByRound[round];
                  const complete = total > 0 && done === total;

                  return (
                    <button
                      key={round}
                      onClick={() => setActiveTab(round)}
                      className={cn(
                        "flex-1 min-w-[52px] h-10 flex flex-col items-center justify-center text-[10px] font-semibold uppercase tracking-wide transition-colors relative",
                        isActive
                          ? "text-primary"
                          : complete
                          ? "text-green-700"
                          : "text-muted-foreground"
                      )}
                    >
                      {/* Active underline */}
                      {isActive && (
                        <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary" />
                      )}
                      <span>{round}</span>
                      {total > 0 && (
                        <span
                          className={cn(
                            "text-[9px] font-normal",
                            isActive ? "text-primary/70" : complete ? "text-green-600" : "text-muted-foreground/60"
                          )}
                        >
                          {done}/{total}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Next arrow */}
              <button
                disabled={!canGoForward}
                onClick={() => canGoForward && setActiveTab(ROUND_ORDER[activeRoundIndex + 1])}
                className="flex-shrink-0 px-3 h-10 flex items-center justify-center text-muted-foreground disabled:opacity-20 hover:text-foreground transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Progress + submit row */}
            <div className="px-4 py-2.5 flex items-center gap-3">
              <div className="flex-1">
                <div className="flex justify-between text-[10px] font-medium text-muted-foreground mb-1">
                  <span>{bracket.completedPicks}/{bracket.totalPicks} picks</span>
                  <span>{Math.round((bracket.completedPicks / bracket.totalPicks) * 100)}%</span>
                </div>
                <Progress value={(bracket.completedPicks / bracket.totalPicks) * 100} className="h-1.5" />
              </div>

              {!isLocked && !bracket.submitted && isComplete && (
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={submitBracketMutation.isPending}
                  className="rounded-sm text-xs font-bold h-8 px-4 shrink-0"
                >
                  Submit
                </Button>
              )}
              {bracket.submitted && (
                <div className="shrink-0 text-[10px] font-bold text-green-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Submitted
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── DESKTOP view ─────────────────────────────────── */}
        <div className="hidden lg:flex flex-1 overflow-x-auto overflow-y-auto bracket-scroll p-8 pb-32 items-start justify-start w-full">
          <div className="flex min-w-max mx-auto gap-6 relative select-none">

            {/* Left side */}
            <div className="flex gap-6">
              {[MatchupRound.R64, MatchupRound.R32, MatchupRound.R16, MatchupRound.QF, MatchupRound.SF].map((round) => {
                const roundMatchups = matchupsByRound[round] ?? [];
                const half = Math.ceil(roundMatchups.length / 2);
                const leftMatchups = roundMatchups.slice(0, half);
                const isResultOnly = isR32Bracket && round === MatchupRound.R64;
                return (
                  <div key={`left-${round}`} className="flex flex-col w-52">
                    <RoundColumnHeader round={round} isResultOnly={isResultOnly} />
                    <div
                      className="flex flex-col flex-1 justify-around gap-3"
                      style={{ minHeight: `${Math.max(leftMatchups.length, 1) * 80}px` }}
                    >
                      {leftMatchups.map((matchup) => isResultOnly ? (
                        <ResultMatchupCard key={matchup.id} matchup={matchup} />
                      ) : (
                        <BracketMatchupCard
                          key={matchup.id}
                          matchup={matchup}
                          pick={picks.find((p) => p.matchupId === matchup.id)}
                          isLocked={isLocked}
                          onPickGolfer={handlePick}
                          isLoading={pendingMatchups[matchup.id]}
                          projectedGolfer1={projectedGolfer1Map.get(matchup.id)}
                          projectedGolfer2={projectedGolfer2Map.get(matchup.id)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Championship center */}
            <div className="flex flex-col justify-center items-center w-56 mx-2">
              <div className="w-full text-center mb-4">
                <div className="flex items-center gap-2 justify-center">
                  <div className="w-4 h-px bg-primary" />
                  <span className="text-[10px] font-semibold tracking-widest uppercase text-primary">Championship</span>
                  <div className="w-4 h-px bg-primary" />
                </div>
              </div>
              {finalMatchup && (
                <div className="w-full mb-8">
                  <BracketMatchupCard
                    matchup={finalMatchup}
                    pick={picks.find((p) => p.matchupId === finalMatchup.id)}
                    isLocked={isLocked}
                    onPickGolfer={handlePick}
                    isLoading={pendingMatchups[finalMatchup.id]}
                    projectedGolfer1={projectedGolfer1Map.get(finalMatchup.id)}
                    projectedGolfer2={projectedGolfer2Map.get(finalMatchup.id)}
                  />
                </div>
              )}
              <ChampionshipCard golfer={championGolfer} isLocked={isLocked} />
            </div>

            {/* Right side */}
            <div className="flex gap-6 flex-row-reverse">
              {[MatchupRound.R64, MatchupRound.R32, MatchupRound.R16, MatchupRound.QF, MatchupRound.SF].map((round) => {
                const roundMatchups = matchupsByRound[round] ?? [];
                const half = Math.ceil(roundMatchups.length / 2);
                const rightMatchups = roundMatchups.slice(half);
                const isResultOnly = isR32Bracket && round === MatchupRound.R64;
                return (
                  <div key={`right-${round}`} className="flex flex-col w-52">
                    <RoundColumnHeader round={round} isResultOnly={isResultOnly} />
                    <div
                      className="flex flex-col flex-1 justify-around gap-3"
                      style={{ minHeight: `${Math.max(rightMatchups.length, 1) * 80}px` }}
                    >
                      {rightMatchups.map((matchup) => isResultOnly ? (
                        <ResultMatchupCard key={matchup.id} matchup={matchup} />
                      ) : (
                        <BracketMatchupCard
                          key={matchup.id}
                          matchup={matchup}
                          pick={picks.find((p) => p.matchupId === matchup.id)}
                          isLocked={isLocked}
                          onPickGolfer={handlePick}
                          isLoading={pendingMatchups[matchup.id]}
                          projectedGolfer1={projectedGolfer1Map.get(matchup.id)}
                          projectedGolfer2={projectedGolfer2Map.get(matchup.id)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RoundColumnHeader({ round, isResultOnly }: { round: MatchupRound; isResultOnly?: boolean }) {
  return (
    <div className="text-center mb-4 pb-2 border-b border-border sticky top-0 bg-gray-50 z-10 py-2">
      <span className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
        {ROUND_DISPLAY_NAMES[round]}
      </span>
      {isResultOnly && (
        <span className="ml-2 text-[9px] font-semibold bg-muted text-muted-foreground px-1.5 py-0.5 rounded uppercase tracking-wide">
          Results
        </span>
      )}
    </div>
  );
}
