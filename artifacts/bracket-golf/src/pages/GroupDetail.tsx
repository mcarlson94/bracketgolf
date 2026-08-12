import { useParams, Link } from "wouter";
import { useGetGroup } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Users, Copy, CheckCircle2, ChevronLeft, Medal } from "lucide-react";
import { useState } from "react";

export default function GroupDetail() {
  const { id } = useParams();
  const { data: group, isLoading, error } = useGetGroup(id as string);
  const [copied, setCopied] = useState(false);

  if (isLoading) {
    return <div className="p-10 text-center text-muted-foreground">Loading group...</div>;
  }

  if (error || !group) {
    return (
      <div className="p-10 text-center">
        <h2 className="text-2xl font-bold mb-4">Group Not Found</h2>
        <Link href="/groups"><Button>Back to Groups</Button></Link>
      </div>
    );
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(group.joinCode);
    setCopied(true);
    toast({ title: "Join code copied to clipboard!" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
      <Link href="/groups" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
        <ChevronLeft className="w-4 h-4 mr-1" /> Back to My Groups
      </Link>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold font-heading mb-2">{group.name}</h1>
          {group.description && <p className="text-muted-foreground text-lg mb-4">{group.description}</p>}
          <div className="flex items-center gap-4 text-sm font-medium">
            <span className="flex items-center bg-secondary/10 text-secondary px-3 py-1 rounded-full">
              <Users className="w-4 h-4 mr-2" />
              {group.memberCount} Members
            </span>
          </div>
        </div>

        <Card className="bg-primary/5 border-primary/20 p-4 md:min-w-[250px]">
          <div className="text-sm font-semibold text-primary mb-2 uppercase tracking-wider">Invite Friends</div>
          <div className="flex items-center justify-between bg-white border rounded-md p-2 shadow-sm">
            <span className="font-mono text-xl font-bold tracking-widest px-2">{group.joinCode}</span>
            <Button variant="ghost" size="icon" onClick={handleCopyCode} className="text-primary hover:bg-primary/10">
              {copied ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">Share this code to let others join.</p>
        </Card>
      </div>

      <Card className="overflow-hidden shadow-md border-t-4 border-t-primary">
        <div className="bg-gray-50 px-6 py-4 border-b">
          <h2 className="text-xl font-bold font-heading">Group Leaderboard</h2>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20 text-center font-bold">Rank</TableHead>
                <TableHead className="font-bold">Member / Bracket</TableHead>
                <TableHead className="font-bold text-right">Score</TableHead>
                <TableHead className="font-bold text-right hidden sm:table-cell">Max</TableHead>
                <TableHead className="font-bold text-right">Champion Pick</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.leaderboard.length > 0 ? (
                group.leaderboard.map((entry, idx) => (
                  <TableRow key={`${entry.bracketId}-${idx}`} className="hover:bg-gray-50">
                    <TableCell className="text-center font-bold font-mono text-lg">
                      {entry.rank === 1 ? <Medal className="w-6 h-6 text-yellow-500 mx-auto" /> : 
                       entry.rank === 2 ? <Medal className="w-6 h-6 text-gray-400 mx-auto" /> : 
                       entry.rank === 3 ? <Medal className="w-6 h-6 text-amber-700 mx-auto" /> : 
                       entry.rank}
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold">{entry.userName}</div>
                      <Link href={`/brackets/${entry.bracketId}`} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                        {entry.bracketName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-bold text-lg text-primary">
                      {entry.score}
                    </TableCell>
                    <TableCell className="text-right hidden sm:table-cell text-muted-foreground font-mono">
                      {entry.maxPossibleScore}
                    </TableCell>
                    <TableCell className="text-right font-medium text-sm">
                      {entry.championName || "-"}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                    No brackets submitted in this group yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
