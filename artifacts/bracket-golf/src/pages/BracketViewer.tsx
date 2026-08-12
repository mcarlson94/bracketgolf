import { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROUND_DISPLAY_NAMES, ROUND_ORDER } from "@/lib/constants";
import { AlertCircle, CheckCircle2, ChevronLeft, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function BracketViewer() {
  const params = useParams();
  const bracketId = params.id as string;
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Active round for mobile tabs
  const [activeTab, setActiveTab] = useState<MatchupRound>(MatchupRound.R64);
  
  // Pending picks state (for loading indicators on specific matchups)
  const [pendingMatchups, setPendingMatchups] = useState<Record<string, boolean>>({});

  const { data: tournament, isLoading: loadingTournament } = useGetTournament();
  const { 
    data: bracketData, 
    isLoading: loadingBracket,
    error: bracketError
  } = useGetBracket(bracketId, {
    query: {
      enabled: !!bracketId,
      retry: false
    }
  });
  
  const { data: matchups, isLoading: loadingMatchups } = useGetMatchups();

  const savePickMutation = useSavePick();
  const submitBracketMutation = useSubmitBracket();

  const isLocked = tournament?.status === 'locked' || tournament?.status === 'completed';
  const bracket = bracketData;
  const picks = bracketData?.picks || [];

  const handlePick = useCallback((matchupId: string, golferId: string) => {
    if (isLocked || !bracket) return;
    
    // Optimistically set pending state for UI
    setPendingMatchups(prev => ({ ...prev, [matchupId]: true }));
    
    savePickMutation.mutate(
      { bracketId, data: { matchupId, selectedGolferId: golferId } },
      {
        onSuccess: (updatedPicks) => {
          // Update the cache locally with the new picks array from server
          queryClient.setQueryData(getGetBracketQueryKey(bracketId), (old: any) => {
            if (!old) return old;
            // Also need to compute completed picks length based on the new array
            const newCompleted = updatedPicks.filter(p => p.selectedGolferId).length;
            
            // Check if final round was picked
            const finalPick = updatedPicks.find(p => p.round === MatchupRound.F);
            let champId = null;
            let champName = null;
            if (finalPick) {
              champId = finalPick.selectedGolferId;
              // find name
              const m = matchups?.find(m => m.id === finalPick.matchupId);
              if (m && m.golfer1?.id === champId) champName = m.golfer1.fullName;
              if (m && m.golfer2?.id === champId) champName = m.golfer2.fullName;
            }

            return {
              ...old,
              picks: updatedPicks,
              completedPicks: newCompleted,
              championGolferId: champId,
              championName: champName
            };
          });
        },
        onError: () => {
          toast({
            title: "Error saving pick",
            description: "Please try again.",
            variant: "destructive"
          });
        },
        onSettled: () => {
          setPendingMatchups(prev => {
            const newState = { ...prev };
            delete newState[matchupId];
            return newState;
          });
        }
      }
    );
  }, [bracketId, isLocked, bracket, savePickMutation, queryClient, matchups]);

  const handleSubmit = () => {
    if (!bracket || bracket.completedPicks < 63) return;
    
    submitBracketMutation.mutate({ bracketId }, {
      onSuccess: (updatedBracket) => {
        toast({
          title: "Bracket Submitted!",
          description: "Good luck in the tournament!",
        });
        queryClient.setQueryData(getGetBracketQueryKey(bracketId), (old: any) => {
          return old ? { ...old, submitted: true, submittedAt: updatedBracket.submittedAt } : old;
        });
      },
      onError: (err: any) => {
        toast({
          title: "Submission failed",
          description: err?.message || "There was an error submitting your bracket.",
          variant: "destructive"
        });
      }
    });
  };

  // Group matchups by round
  const matchupsByRound = useMemo(() => {
    if (!matchups) return {} as Record<MatchupRound, typeof matchups>;
    const grouped = {} as Record<MatchupRound, typeof matchups>;
    ROUND_ORDER.forEach(r => grouped[r] = []);
    
    matchups.forEach(m => {
      if (grouped[m.round]) {
        grouped[m.round].push(m);
      }
    });
    
    // Sort by position within each round
    Object.keys(grouped).forEach(k => {
      const round = k as MatchupRound;
      grouped[round].sort((a, b) => a.position - b.position);
    });
    
    return grouped;
  }, [matchups]);

  if (loadingBracket || loadingMatchups || loadingTournament) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground font-medium">Loading bracket...</p>
        </div>
      </div>
    );
  }

  if (bracketError || !bracket) {
    return (
      <div className="max-w-3xl mx-auto mt-20 text-center space-y-6">
        <AlertCircle className="w-16 h-16 text-destructive mx-auto" />
        <h2 className="text-2xl font-bold">Bracket Not Found</h2>
        <p className="text-muted-foreground">The bracket you are looking for doesn't exist or you don't have access.</p>
        <Button onClick={() => setLocation('/dashboard')}>Return to Dashboard</Button>
      </div>
    );
  }

  const isComplete = bracket.completedPicks === 63;
  const isSaving = Object.keys(pendingMatchups).length > 0;

  // Find championship details
  const finalMatchup = matchupsByRound[MatchupRound.F]?.[0];
  const finalPick = picks.find(p => p.round === MatchupRound.F);
  let championGolfer = undefined;
  if (finalPick?.selectedGolferId && finalMatchup) {
    if (finalMatchup.golfer1?.id === finalPick.selectedGolferId) championGolfer = finalMatchup.golfer1;
    else if (finalMatchup.golfer2?.id === finalPick.selectedGolferId) championGolfer = finalMatchup.golfer2;
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] bg-gray-50">
      {/* Header Bar */}
      <div className="bg-white border-b sticky top-[64px] z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setLocation('/dashboard')} className="shrink-0 hidden sm:flex">
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold font-heading">{bracket.name}</h1>
                <div className="flex items-center gap-3 text-sm mt-1">
                  <span className="text-muted-foreground">
                    {tournament?.name}
                  </span>
                  <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                  <span className="font-semibold text-primary">
                    {bracket.score} pts
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-medium text-foreground flex items-center justify-end gap-2">
                  {isSaving ? (
                    <span className="flex items-center text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin mr-1"/> Saving...</span>
                  ) : (
                    <span className="flex items-center text-green-600"><CheckCircle2 className="w-3 h-3 mr-1"/> Saved</span>
                  )}
                  <span>•</span>
                  {bracket.completedPicks}/63 Picks
                </div>
                <div className="w-48 mt-1">
                  <Progress value={(bracket.completedPicks/63)*100} className="h-1.5" />
                </div>
              </div>
              
              {!isLocked && !bracket.submitted && isComplete && (
                <Button 
                  onClick={handleSubmit} 
                  disabled={submitBracketMutation.isPending}
                  className="animate-in fade-in zoom-in font-bold shadow-md"
                >
                  Submit Bracket
                </Button>
              )}
              {!isLocked && bracket.submitted && (
                <div className="px-3 py-1.5 bg-green-100 text-green-800 rounded-md text-sm font-semibold flex items-center shadow-sm">
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Submitted
                </div>
              )}
              {isLocked && (
                <div className="px-3 py-1.5 bg-secondary text-secondary-foreground rounded-md text-sm font-semibold flex items-center shadow-sm">
                  Picks Locked
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Bracket Area */}
      <div className="flex-1 w-full overflow-hidden flex flex-col">
        
        {/* Mobile View (Tabs) */}
        <div className="lg:hidden flex flex-col h-full overflow-hidden">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as MatchupRound)} className="w-full flex flex-col h-full">
            <div className="bg-white border-b px-2 py-2">
              <TabsList className="w-full h-auto flex-wrap bg-transparent justify-start gap-1 p-0">
                {ROUND_ORDER.map(round => (
                  <TabsTrigger 
                    key={round} 
                    value={round}
                    className="data-[state=active]:bg-primary data-[state=active]:text-white rounded-full px-4 py-1.5"
                  >
                    {round}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 pb-32">
              <TabsContent value={activeTab} className="mt-0 space-y-4">
                <div className="text-lg font-bold font-heading mb-4 text-center text-muted-foreground border-b pb-2">
                  {ROUND_DISPLAY_NAMES[activeTab]}
                </div>
                
                {activeTab === MatchupRound.F && championGolfer && (
                  <div className="mb-8">
                    <ChampionshipCard golfer={championGolfer} isLocked={isLocked} />
                  </div>
                )}
                
                <div className="grid gap-4 max-w-sm mx-auto">
                  {matchupsByRound[activeTab]?.map(matchup => (
                    <BracketMatchupCard 
                      key={matchup.id} 
                      matchup={matchup} 
                      pick={picks.find(p => p.matchupId === matchup.id)}
                      isLocked={isLocked}
                      onPickGolfer={handlePick}
                      isLoading={pendingMatchups[matchup.id]}
                    />
                  ))}
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Desktop View (Horizontal Scroll) */}
        <div className="hidden lg:flex flex-1 overflow-x-auto overflow-y-auto bracket-scroll p-8 pb-32 items-start justify-start w-full relative">
          
          <div className="flex min-w-max mx-auto gap-8 relative select-none">
            
            {/* Left Side */}
            <div className="flex gap-8">
              {[MatchupRound.R64, MatchupRound.R32, MatchupRound.R16, MatchupRound.QF, MatchupRound.SF].map((round, colIndex) => {
                const roundMatchups = matchupsByRound[round] || [];
                const halfCount = roundMatchups.length / 2;
                const leftMatchups = roundMatchups.slice(0, halfCount);
                
                return (
                  <div key={`left-${round}`} className="flex flex-col relative w-56">
                    <div className="text-center font-bold text-muted-foreground text-sm uppercase tracking-wider mb-6 sticky top-0 bg-gray-50 py-2 z-10">
                      {ROUND_DISPLAY_NAMES[round]}
                    </div>
                    <div className="flex flex-col flex-1 justify-around gap-4" style={{ minHeight: `${leftMatchups.length * 80}px` }}>
                      {leftMatchups.map(matchup => (
                        <div key={matchup.id} className="relative z-20">
                          <BracketMatchupCard 
                            matchup={matchup} 
                            pick={picks.find(p => p.matchupId === matchup.id)}
                            isLocked={isLocked}
                            onPickGolfer={handlePick}
                            isLoading={pendingMatchups[matchup.id]}
                          />
                          {/* Visual connecting lines could go here, complex to build without a dedicated library, keeping it clean for now */}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Championship Center */}
            <div className="flex flex-col justify-center items-center w-64 mx-4">
              <div className="text-center font-bold text-primary text-sm uppercase tracking-wider mb-6 sticky top-0 bg-gray-50 py-2 z-10 w-full border-b-2 border-primary/20">
                Championship
              </div>
              
              <div className="mb-12 w-full z-20">
                {finalMatchup && (
                  <BracketMatchupCard 
                    matchup={finalMatchup} 
                    pick={picks.find(p => p.matchupId === finalMatchup.id)}
                    isLocked={isLocked}
                    onPickGolfer={handlePick}
                    isLoading={pendingMatchups[finalMatchup.id]}
                  />
                )}
              </div>
              
              <div className="w-full z-20 mt-4">
                <ChampionshipCard golfer={championGolfer} isLocked={isLocked} />
              </div>
            </div>

            {/* Right Side */}
            <div className="flex gap-8 flex-row-reverse">
              {[MatchupRound.R64, MatchupRound.R32, MatchupRound.R16, MatchupRound.QF, MatchupRound.SF].map((round, colIndex) => {
                const roundMatchups = matchupsByRound[round] || [];
                const halfCount = roundMatchups.length / 2;
                const rightMatchups = roundMatchups.slice(halfCount);
                
                return (
                  <div key={`right-${round}`} className="flex flex-col relative w-56">
                    <div className="text-center font-bold text-muted-foreground text-sm uppercase tracking-wider mb-6 sticky top-0 bg-gray-50 py-2 z-10">
                      {ROUND_DISPLAY_NAMES[round]}
                    </div>
                    <div className="flex flex-col flex-1 justify-around gap-4" style={{ minHeight: `${rightMatchups.length * 80}px` }}>
                      {rightMatchups.map(matchup => (
                        <div key={matchup.id} className="relative z-20">
                          <BracketMatchupCard 
                            matchup={matchup} 
                            pick={picks.find(p => p.matchupId === matchup.id)}
                            isLocked={isLocked}
                            onPickGolfer={handlePick}
                            isLoading={pendingMatchups[matchup.id]}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            
          </div>
        </div>

      </div>

      {/* Sticky Mobile Progress Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-bold">{bracket.completedPicks}/63 Picks</div>
          <div className="text-sm text-muted-foreground">{Math.round((bracket.completedPicks/63)*100)}%</div>
        </div>
        <Progress value={(bracket.completedPicks/63)*100} className="h-2 mb-3" />
        
        {!isLocked && !bracket.submitted && isComplete && (
          <Button onClick={handleSubmit} disabled={submitBracketMutation.isPending} className="w-full">
            Submit Final Bracket
          </Button>
        )}
      </div>
    </div>
  );
}
