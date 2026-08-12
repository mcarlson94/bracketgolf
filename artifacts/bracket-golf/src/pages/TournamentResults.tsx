import { useGetTournament, useGetMatchups, MatchupRound, Matchup } from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROUND_DISPLAY_NAMES, ROUND_ORDER } from "@/lib/constants";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Trophy, Calendar } from "lucide-react";
import { format } from "date-fns";

export default function TournamentResults() {
  const { data: tournament, isLoading: loadingTournament } = useGetTournament();
  const { data: matchups, isLoading: loadingMatchups } = useGetMatchups();
  const [activeTab, setActiveTab] = useState<MatchupRound>(MatchupRound.R64);

  const matchupsByRound = useMemo(() => {
    if (!matchups) return {} as Record<MatchupRound, typeof matchups>;
    const grouped = {} as Record<MatchupRound, typeof matchups>;
    ROUND_ORDER.forEach(r => grouped[r] = []);
    
    matchups.forEach(m => {
      if (grouped[m.round]) {
        grouped[m.round].push(m);
      }
    });
    
    Object.keys(grouped).forEach(k => {
      const round = k as MatchupRound;
      grouped[round].sort((a, b) => a.position - b.position);
    });
    
    return grouped;
  }, [matchups]);

  if (loadingTournament || loadingMatchups) {
    return <div className="p-20 text-center">Loading tournament results...</div>;
  }

  if (!tournament || !matchups || matchups.length === 0) {
    return (
      <div className="max-w-3xl mx-auto mt-20 text-center space-y-4">
        <Calendar className="w-16 h-16 text-gray-300 mx-auto" />
        <h2 className="text-2xl font-bold">Tournament Not Ready</h2>
        <p className="text-muted-foreground">The bracket hasn't been set yet. Check back soon.</p>
      </div>
    );
  }

  const renderMatchupCard = (matchup: Matchup) => {
    const g1 = matchup.golfer1;
    const g2 = matchup.golfer2;
    const isCompleted = matchup.status === 'completed';
    const hasWinner = !!matchup.winnerId;

    return (
      <div key={matchup.id} className="flex flex-col border rounded-md overflow-hidden bg-card text-sm shadow-sm relative">
        {matchup.status === 'live' && (
          <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-md z-20 uppercase tracking-wider animate-pulse">
            Live
          </div>
        )}
        {isCompleted && matchup.matchScore && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white/90 backdrop-blur text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-sm z-20 text-muted-foreground">
            {matchup.matchScore}
          </div>
        )}

        <div className={cn(
          "flex items-center justify-between p-2 border-b relative transition-all",
          hasWinner && matchup.winnerId === g1?.id ? "bg-green-50 font-bold" : "",
          hasWinner && matchup.winnerId !== g1?.id ? "opacity-50 grayscale-[50%]" : ""
        )}>
          <div className="flex items-center gap-2 overflow-hidden z-10 w-full">
            <span className="text-xs font-mono font-medium text-muted-foreground w-4 text-center">{g1?.seed || "-"}</span>
            <span className="truncate">{g1?.fullName || "TBD"}</span>
            {hasWinner && matchup.winnerId === g1?.id && <span className="ml-auto text-green-600 text-xs">✓</span>}
          </div>
        </div>

        <div className={cn(
          "flex items-center justify-between p-2 relative transition-all",
          hasWinner && matchup.winnerId === g2?.id ? "bg-green-50 font-bold" : "",
          hasWinner && matchup.winnerId !== g2?.id ? "opacity-50 grayscale-[50%]" : ""
        )}>
          <div className="flex items-center gap-2 overflow-hidden z-10 w-full">
            <span className="text-xs font-mono font-medium text-muted-foreground w-4 text-center">{g2?.seed || "-"}</span>
            <span className="truncate">{g2?.fullName || "TBD"}</span>
            {hasWinner && matchup.winnerId === g2?.id && <span className="ml-auto text-green-600 text-xs">✓</span>}
          </div>
        </div>
      </div>
    );
  };

  const finalMatchup = matchupsByRound[MatchupRound.F]?.[0];
  const champion = finalMatchup?.winner;

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] bg-gray-50">
      <div className="bg-secondary text-white py-8 border-b">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h1 className="text-3xl font-bold font-heading mb-2">Live Tournament Results</h1>
          <p className="text-gray-400">
            {tournament.name} • Status: <span className="uppercase text-primary">{tournament.status}</span>
            {tournament.lastSyncedAt && ` • Last updated: ${format(new Date(tournament.lastSyncedAt), "h:mm a")}`}
          </p>
        </div>
      </div>

      <div className="flex-1 w-full overflow-hidden flex flex-col pt-4">
        
        {/* Mobile View */}
        <div className="lg:hidden flex flex-col h-full overflow-hidden">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as MatchupRound)} className="w-full flex flex-col h-full">
            <div className="px-4 py-2">
              <TabsList className="w-full h-auto flex-wrap bg-white border justify-start gap-1 p-1">
                {ROUND_ORDER.map(round => (
                  <TabsTrigger key={round} value={round} className="data-[state=active]:bg-secondary data-[state=active]:text-white rounded-md px-3 py-1.5 text-xs">
                    {round}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            <div className="flex-1 overflow-y-auto p-4 pb-20">
              <TabsContent value={activeTab} className="mt-0 space-y-4">
                <div className="grid gap-3 max-w-sm mx-auto">
                  {matchupsByRound[activeTab]?.map(renderMatchupCard)}
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Desktop View (Horizontal Scroll) */}
        <div className="hidden lg:flex flex-1 overflow-x-auto overflow-y-auto bracket-scroll p-8 pb-32 items-start justify-start w-full">
          <div className="flex min-w-max mx-auto gap-8">
            
            {/* Left Side */}
            <div className="flex gap-8">
              {[MatchupRound.R64, MatchupRound.R32, MatchupRound.R16, MatchupRound.QF, MatchupRound.SF].map((round) => {
                const roundMatchups = matchupsByRound[round] || [];
                const halfCount = roundMatchups.length / 2;
                const leftMatchups = roundMatchups.slice(0, halfCount);
                
                return (
                  <div key={`left-${round}`} className="flex flex-col w-56">
                    <div className="text-center font-bold text-muted-foreground text-sm uppercase tracking-wider mb-6 sticky top-0 py-2">
                      {ROUND_DISPLAY_NAMES[round]}
                    </div>
                    <div className="flex flex-col flex-1 justify-around gap-4" style={{ minHeight: `${leftMatchups.length * 80}px` }}>
                      {leftMatchups.map(renderMatchupCard)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Championship Center */}
            <div className="flex flex-col justify-center items-center w-64 mx-4">
              <div className="text-center font-bold text-primary text-sm uppercase tracking-wider mb-6 w-full border-b-2 border-primary/20 pb-2">
                Championship
              </div>
              <div className="mb-8 w-full">
                {finalMatchup && renderMatchupCard(finalMatchup)}
              </div>
              {champion && (
                <div className="flex flex-col items-center justify-center p-6 border-2 border-yellow-400 bg-yellow-50 rounded-xl shadow-lg w-full text-center">
                  <Trophy className="w-12 h-12 text-yellow-500 mb-2" />
                  <div className="text-xs font-bold text-yellow-700 uppercase tracking-wider mb-1">Champion</div>
                  <div className="font-heading font-bold text-xl text-yellow-900">{champion.fullName}</div>
                </div>
              )}
            </div>

            {/* Right Side */}
            <div className="flex gap-8 flex-row-reverse">
              {[MatchupRound.R64, MatchupRound.R32, MatchupRound.R16, MatchupRound.QF, MatchupRound.SF].map((round) => {
                const roundMatchups = matchupsByRound[round] || [];
                const halfCount = roundMatchups.length / 2;
                const rightMatchups = roundMatchups.slice(halfCount);
                
                return (
                  <div key={`right-${round}`} className="flex flex-col w-56">
                    <div className="text-center font-bold text-muted-foreground text-sm uppercase tracking-wider mb-6 sticky top-0 py-2">
                      {ROUND_DISPLAY_NAMES[round]}
                    </div>
                    <div className="flex flex-col flex-1 justify-around gap-4" style={{ minHeight: `${rightMatchups.length * 80}px` }}>
                      {rightMatchups.map(renderMatchupCard)}
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
