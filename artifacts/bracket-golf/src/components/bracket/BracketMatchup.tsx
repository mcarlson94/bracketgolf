import { 
  Matchup, 
  Golfer, 
  BracketPick, 
  TournamentStatus,
  BracketPickStatus
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { Trophy, Check, X } from "lucide-react";

interface BracketMatchupProps {
  matchup: Matchup;
  pick?: BracketPick;
  isLocked: boolean;
  onPickGolfer?: (matchupId: string, golferId: string) => void;
  isLoading?: boolean;
}

export function BracketMatchupCard({ 
  matchup, 
  pick, 
  isLocked, 
  onPickGolfer,
  isLoading 
}: BracketMatchupProps) {
  const g1 = matchup.golfer1;
  const g2 = matchup.golfer2;

  const handleSelect = (golferId?: string | null) => {
    if (isLocked || !golferId || !onPickGolfer || isLoading) return;
    onPickGolfer(matchup.id, golferId);
  };

  // Status visual indicator after lock
  const renderStatusIcon = (golferId?: string | null) => {
    if (!isLocked || !pick || !golferId) return null;
    
    // In read-only / results mode (handled differently by page, but here we show pick status)
    if (pick.selectedGolferId === golferId) {
      if (pick.status === BracketPickStatus.correct) {
        return <div className="w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center shadow-sm"><Check className="w-3 h-3" /></div>;
      }
      if (pick.status === BracketPickStatus.incorrect) {
        return <div className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow-sm"><X className="w-3 h-3" /></div>;
      }
      if (pick.status === BracketPickStatus.eliminated) {
        return <div className="w-5 h-5 rounded-full bg-gray-300 text-white flex items-center justify-center"><X className="w-3 h-3" /></div>;
      }
    }
    return null;
  };

  return (
    <div className={cn(
      "flex flex-col border rounded-md overflow-hidden bg-card text-sm shadow-sm transition-all",
      isLoading && "opacity-50 pointer-events-none"
    )}>
      {/* Golfer 1 */}
      <div 
        onClick={() => handleSelect(g1?.id)}
        className={cn(
          "flex items-center justify-between p-2 border-b cursor-pointer transition-colors relative",
          !isLocked && "hover:bg-gray-50",
          pick?.selectedGolferId === g1?.id && "bg-primary/5",
          isLocked && !pick?.selectedGolferId && "cursor-default"
        )}
      >
        <div className="flex items-center gap-2 overflow-hidden z-10">
          <span className="text-xs font-mono font-medium text-muted-foreground w-4 text-center">
            {g1?.seed || "-"}
          </span>
          <span className={cn(
            "font-semibold truncate",
            !g1 && "text-muted-foreground italic font-normal",
            pick?.selectedGolferId === g1?.id && "text-primary"
          )}>
            {g1?.fullName || "TBD"}
          </span>
        </div>
        
        {/* Selection Indicator */}
        <div className="flex items-center gap-2 z-10">
          {pick?.selectedGolferId === g1?.id && !isLocked && (
            <Check className="w-4 h-4 text-primary" />
          )}
          {renderStatusIcon(g1?.id)}
        </div>

        {/* Selected styling background */}
        {pick?.selectedGolferId === g1?.id && (
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
        )}
      </div>

      {/* Golfer 2 */}
      <div 
        onClick={() => handleSelect(g2?.id)}
        className={cn(
          "flex items-center justify-between p-2 cursor-pointer transition-colors relative",
          !isLocked && "hover:bg-gray-50",
          pick?.selectedGolferId === g2?.id && "bg-primary/5",
          isLocked && !pick?.selectedGolferId && "cursor-default"
        )}
      >
        <div className="flex items-center gap-2 overflow-hidden z-10">
          <span className="text-xs font-mono font-medium text-muted-foreground w-4 text-center">
            {g2?.seed || "-"}
          </span>
          <span className={cn(
            "font-semibold truncate",
            !g2 && "text-muted-foreground italic font-normal",
            pick?.selectedGolferId === g2?.id && "text-primary"
          )}>
            {g2?.fullName || "TBD"}
          </span>
        </div>
        
        {/* Selection Indicator */}
        <div className="flex items-center gap-2 z-10">
          {pick?.selectedGolferId === g2?.id && !isLocked && (
            <Check className="w-4 h-4 text-primary" />
          )}
          {renderStatusIcon(g2?.id)}
        </div>

        {/* Selected styling background */}
        {pick?.selectedGolferId === g2?.id && (
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
        )}
      </div>
    </div>
  );
}

export function ChampionshipCard({
  golfer,
  isLocked
}: {
  golfer?: Golfer;
  isLocked: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-6 border-2 border-primary/20 rounded-xl bg-white shadow-xl max-w-xs mx-auto text-center w-full">
      <div className="w-16 h-16 bg-gradient-to-br from-yellow-300 to-yellow-500 rounded-full flex items-center justify-center mb-4 shadow-lg border border-yellow-200">
        <span className="text-3xl">🏆</span>
      </div>
      <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">
        U.S. Amateur Champion
      </h3>
      {golfer ? (
        <div className="font-heading font-bold text-2xl text-foreground">
          {golfer.fullName}
        </div>
      ) : (
        <div className="font-heading text-xl text-muted-foreground italic">
          Make Final Pick
        </div>
      )}
      
      {isLocked && golfer && (
        <div className="mt-4 text-xs font-semibold px-3 py-1 bg-secondary text-secondary-foreground rounded-full">
          LOCKED
        </div>
      )}
    </div>
  );
}
