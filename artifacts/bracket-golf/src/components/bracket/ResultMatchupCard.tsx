/**
 * ResultMatchupCard — read-only display for completed rounds (R64).
 * Shows winner in green, loser in red with strikethrough, plus tee time / score.
 */
import { Matchup } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { Check, X, Clock } from "lucide-react";
import { format } from "date-fns";

interface ResultMatchupCardProps {
  matchup: Matchup;
}

function formatTeeTime(teeTime: string | null | undefined): string | null {
  if (!teeTime) return null;
  try {
    return format(new Date(teeTime), "h:mm a");
  } catch {
    return null;
  }
}

export function ResultMatchupCard({ matchup }: ResultMatchupCardProps) {
  const g1 = matchup.golfer1 ?? null;
  const g2 = matchup.golfer2 ?? null;
  const winnerId = matchup.winnerId ?? null;
  const teeTimeStr = formatTeeTime((matchup as any).teeTime);
  const isCompleted = matchup.status === "completed";
  const isInProgress = matchup.status === "in_progress" || matchup.status === "live";
  const isScheduled = !isCompleted && !isInProgress;

  const GolferRow = ({
    golfer,
    isBottom,
  }: {
    golfer: typeof g1;
    isBottom?: boolean;
  }) => {
    if (!golfer) {
      return (
        <div className={cn("flex items-center px-3 py-2.5 bg-muted/30", !isBottom && "border-b border-border")}>
          <span className="text-xs text-muted-foreground italic">TBD</span>
        </div>
      );
    }

    const isWinner = winnerId === golfer.id;
    const isLoser = winnerId !== null && winnerId !== golfer.id;

    return (
      <div
        className={cn(
          "relative flex items-center justify-between px-3 py-2.5 transition-colors",
          !isBottom && "border-b border-border",
          isWinner && "bg-green-50",
          isLoser && "bg-red-50/40",
        )}
      >
        {/* Side bar */}
        {isWinner && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-green-500" />}
        {isLoser && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-red-300" />}

        <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
          <span className="text-[10px] font-mono text-muted-foreground w-5 text-right shrink-0">
            {golfer.seed ?? "–"}
          </span>
          <span className={cn(
            "text-sm truncate font-semibold",
            isWinner && "text-green-800",
            isLoser && "text-red-400 line-through decoration-red-400",
            !isWinner && !isLoser && "text-foreground",
          )}>
            {golfer.fullName}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {isWinner && (
            <div className="w-4 h-4 rounded-full bg-green-600 text-white flex items-center justify-center">
              <Check className="w-2.5 h-2.5" />
            </div>
          )}
          {isLoser && (
            <div className="w-4 h-4 rounded-full bg-red-300 text-white flex items-center justify-center">
              <X className="w-2.5 h-2.5" />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col border border-border bg-card shadow-xs overflow-hidden">
      {/* Tee time / status header */}
      {(teeTimeStr || matchup.matchScore || isInProgress) && (
        <div className={cn(
          "flex items-center gap-1.5 px-3 py-1 text-[10px] font-semibold border-b border-border",
          isCompleted && matchup.matchScore && "bg-muted/30 text-muted-foreground",
          isInProgress && "bg-amber-50 text-amber-700",
          isScheduled && teeTimeStr && "bg-blue-50 text-blue-700",
        )}>
          {isInProgress && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
          {isScheduled && teeTimeStr && <Clock className="w-3 h-3" />}
          <span>
            {isInProgress
              ? matchup.matchScore
                ? `In Progress · ${matchup.matchScore}`
                : "In Progress"
              : isCompleted && matchup.matchScore
              ? matchup.matchScore
              : teeTimeStr}
          </span>
        </div>
      )}
      <GolferRow golfer={g1} />
      <GolferRow golfer={g2} isBottom />
    </div>
  );
}
