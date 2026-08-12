import { useState } from "react";
import { Link } from "wouter";
import { useGetLeaderboard, useGetTournament } from "@workspace/api-client-react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Medal, ChevronLeft, ChevronRight } from "lucide-react";

export default function Leaderboard() {
  const [page, setPage] = useState(1);
  const limit = 50;

  const { data: tournament } = useGetTournament();
  const { data: leaderboardData, isLoading } = useGetLeaderboard({ 
    page, 
    limit 
  });

  const entries = leaderboardData?.entries || [];
  const total = leaderboardData?.total || 0;
  const currentUserRank = leaderboardData?.currentUserRank;
  
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold font-heading">Global Leaderboard</h1>
        <p className="text-muted-foreground text-lg">
          {tournament?.name || "2026 U.S. Amateur"}
        </p>
      </div>

      {currentUserRank && (
        <Card className="bg-primary text-primary-foreground border-none p-6 flex flex-col md:flex-row items-center justify-between shadow-lg">
          <div className="flex items-center gap-4 mb-4 md:mb-0">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-heading">Your Rank</h2>
              <p className="text-primary-foreground/80">Out of {total} brackets</p>
            </div>
          </div>
          <div className="text-4xl font-bold font-mono">
            #{currentUserRank}
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="w-20 text-center font-bold">Rank</TableHead>
                <TableHead className="font-bold">Bracket Name</TableHead>
                <TableHead className="font-bold hidden md:table-cell">Player</TableHead>
                <TableHead className="font-bold text-right">Score</TableHead>
                <TableHead className="font-bold text-right hidden sm:table-cell">Max</TableHead>
                <TableHead className="font-bold text-right">Champion Pick</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    Loading leaderboard...
                  </TableCell>
                </TableRow>
              ) : entries.length > 0 ? (
                entries.map((entry, idx) => {
                  const isTop3 = entry.rank <= 3;
                  return (
                    <TableRow 
                      key={`${entry.bracketId}-${idx}`}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <TableCell className="text-center font-bold font-mono text-lg">
                        {entry.rank === 1 ? <Medal className="w-6 h-6 text-yellow-500 mx-auto" /> : 
                         entry.rank === 2 ? <Medal className="w-6 h-6 text-gray-400 mx-auto" /> : 
                         entry.rank === 3 ? <Medal className="w-6 h-6 text-amber-700 mx-auto" /> : 
                         entry.rank}
                      </TableCell>
                      <TableCell className="font-semibold text-base">
                        <Link href={`/brackets/${entry.bracketId}`} className="hover:text-primary transition-colors">
                          {entry.bracketName}
                        </Link>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {entry.userName}
                      </TableCell>
                      <TableCell className="text-right font-bold text-lg text-primary">
                        {entry.score}
                      </TableCell>
                      <TableCell className="text-right hidden sm:table-cell text-muted-foreground font-mono">
                        {entry.maxPossibleScore}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {entry.championName || "-"}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    No brackets have been scored yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t bg-gray-50">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Prev
            </Button>
            <div className="text-sm font-medium text-muted-foreground">
              Page {page} of {totalPages}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
