import {
  Matchup,
  Golfer,
  BracketPick,
  BracketPickStatus
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { Check, X, Clock } from "lucide-react";
import { format } from "date-fns";

interface BracketMatchupProps {
  matchup: Matchup;
  pick?: BracketPick;
  isLocked: boolean;
  onPickGolfer?: (matchupId: string, golferId: string) => void;
  isLoading?: boolean;
  /** Projected golfers propagated forward from user picks in earlier rounds */
  projectedGolfer1?: Golfer | null;
  projectedGolfer2?: Golfer | null;
}

export function BracketMatchupCard({
  matchup,
  pick,
  isLocked,
  onPickGolfer,
  isLoading,
  projectedGolfer1,
  projectedGolfer2,
}: BracketMatchupProps) {
  // Real golfer takes priority; fall back to projected (from user picks)
  const g1 = matchup.golfer1 ?? projectedGolfer1 ?? null;
  const g2 = matchup.golfer2 ?? projectedGolfer2 ?? null;
  const isProjected1 = !matchup.golfer1 && !!projectedGolfer1;
  const isProjected2 = !matchup.golfer2 && !!projectedGolfer2;

  const handleSelect = (golferId?: string | null) => {
    if (isLocked || !golferId || !onPickGolfer || isLoading) return;
    onPickGolfer(matchup.id, golferId);
  };

  const renderStatusIcon = (golferId?: string | null) => {
    if (!isLocked || !pick || !golferId) return null;
    if (pick.selectedGolferId === golferId) {
      if (pick.status === BracketPickStatus.correct)
        return <div className="w-4 h-4 rounded-full bg-green-600 text-white flex items-center justify-center"><Check className="w-2.5 h-2.5" /></div>;
      if (pick.status === BracketPickStatus.incorrect)
        return <div className="w-4 h-4 rounded-full bg-destructive text-white flex items-center justify-center"><X className="w-2.5 h-2.5" /></div>;
      if (pick.status === BracketPickStatus.eliminated)
        return <div className="w-4 h-4 rounded-full bg-muted-foreground/30 text-white flex items-center justify-center"><X className="w-2.5 h-2.5" /></div>;
    }
    return null;
  };

  const GolferRow = ({
    golfer,
    isProjected,
    isBottom,
  }: {
    golfer: Golfer | null;
    isProjected?: boolean;
    isBottom?: boolean;
  }) => {
    const selected = pick?.selectedGolferId === golfer?.id;
    const canPick = !isLocked && !!golfer?.id;

    return (
      <div
        onClick={() => handleSelect(golfer?.id)}
        className={cn(
          "relative flex items-center justify-between px-3 py-2.5 transition-colors",
          !isBottom && "border-b border-border",
          canPick && "cursor-pointer",
          canPick && !selected && "hover:bg-gray-50",
          selected && "bg-primary/5",
        )}
      >
        {/* Left accent bar when selected */}
        {selected && (
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary" />
        )}

        <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
          {/* Seed */}
          <span className="text-[10px] font-mono text-muted-foreground w-5 text-right shrink-0">
            {golfer?.seed ?? "–"}
          </span>
          {/* Name */}
          <span className={cn(
            "text-sm truncate",
            !golfer
              ? "text-muted-foreground italic font-normal"
              : isProjected
              ? "font-medium text-foreground/70"   // projected: slightly dimmed
              : "font-semibold",
            selected && "text-primary font-semibold",
          )}>
            {golfer?.fullName ?? "TBD"}
          </span>
          {/* Projected indicator */}
          {isProjected && !selected && (
            <span className="shrink-0 text-[9px] text-muted-foreground/60 font-normal italic">
              projected
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {selected && !isLocked && <Check className="w-3.5 h-3.5 text-primary" />}
          {renderStatusIcon(golfer?.id)}
        </div>
      </div>
    );
  };

  // Tee time — only show for scheduled/in-progress matches
  const teeTimeRaw = (matchup as any).teeTime as string | null | undefined;
  const isScheduled = matchup.status === "scheduled" || matchup.status === "in_progress";
  let teeTimeLabel: string | null = null;
  if (teeTimeRaw && isScheduled) {
    try { teeTimeLabel = format(new Date(teeTimeRaw), "h:mm a"); } catch { /* ignore */ }
  }

  return (
    <div className={cn(
      "flex flex-col border border-border bg-card shadow-xs overflow-hidden transition-opacity",
      isLoading && "opacity-50 pointer-events-none"
    )}>
      {teeTimeLabel && (
        <div className="flex items-center gap-1 px-3 py-1 bg-blue-50 border-b border-blue-100 text-[10px] font-semibold text-blue-700">
          <Clock className="w-3 h-3" />
          {teeTimeLabel}
        </div>
      )}
      <GolferRow golfer={g1} isProjected={isProjected1} />
      <GolferRow golfer={g2} isProjected={isProjected2} isBottom />
    </div>
  );
}

export function ChampionshipCard({
  golfer,
  isLocked,
}: {
  golfer?: Golfer;
  isLocked: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-6 border-2 border-primary bg-white shadow-md max-w-xs mx-auto text-center w-full">
      <div className="w-14 h-14 bg-amber-50 border border-amber-200 flex items-center justify-center mb-4">
        <span className="text-3xl leading-none">🏆</span>
      </div>
      <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground mb-2">
        U.S. Amateur Champion
      </p>
      {golfer ? (
        <p className="font-bold text-xl text-foreground">{golfer.fullName}</p>
      ) : (
        <p className="text-base text-muted-foreground italic">Make final pick</p>
      )}
      {isLocked && golfer && (
        <div className="mt-3 text-[10px] font-bold px-2.5 py-1 bg-secondary text-secondary-foreground rounded-sm tracking-widest uppercase">
          Locked
        </div>
      )}
    </div>
  );
}
