import { Link, useLocation } from "wouter";
import { useState } from "react";
import { 
  useGetBrackets, 
  useGetTournament,
  useCreateBracket,
  useDeleteBracket,
  useGetGroups
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Plus, Users, ArrowRight, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);

  const { data: tournament, isLoading: loadingTourney } = useGetTournament();
  const { data: brackets, isLoading: loadingBrackets } = useGetBrackets();
  const { data: groups, isLoading: loadingGroups } = useGetGroups();
  
  const createBracketMutation = useCreateBracket();
  const deleteBracketMutation = useDeleteBracket();

  const handleCreateBracket = () => {
    setIsCreating(true);
    createBracketMutation.mutate(
      { data: { name: `My Bracket ${brackets ? brackets.length + 1 : 1}` } },
      {
        onSuccess: (newBracket) => {
          queryClient.invalidateQueries({ queryKey: ["/api/brackets"] });
          setLocation(`/brackets/${newBracket.id}`);
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to create bracket. Tournament might not be ready.",
            variant: "destructive"
          });
          setIsCreating(false);
        }
      }
    );
  };

  const handleDeleteBracket = (e: React.MouseEvent, bracketId: string) => {
    e.preventDefault();
    if (!confirm("Are you sure you want to delete this bracket?")) return;
    
    deleteBracketMutation.mutate(
      { bracketId },
      {
        onSuccess: () => {
          toast({ title: "Bracket deleted" });
          queryClient.invalidateQueries({ queryKey: ["/api/brackets"] });
        },
        onError: () => {
          toast({ title: "Failed to delete bracket", variant: "destructive" });
        }
      }
    );
  };

  const isLocked = tournament?.status === 'locked' || tournament?.status === 'completed';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Header Section */}
      <div className="bg-secondary rounded-2xl p-8 md:p-10 text-white relative overflow-hidden shadow-lg">
        <div className="absolute right-0 top-0 opacity-10 pointer-events-none transform translate-x-1/3 -translate-y-1/4">
          <Trophy className="w-64 h-64" />
        </div>
        <div className="relative z-10">
          <h1 className="text-3xl md:text-5xl font-bold font-heading mb-4">
            {tournament?.name || "2026 U.S. Amateur Bracket Challenge"}
          </h1>
          <p className="text-lg md:text-xl text-gray-300 mb-8 max-w-2xl">
            Think you know who will win the Havemeyer Trophy? Fill out your bracket and compete for glory.
          </p>
          {!isLocked && (
            <Button 
              size="lg" 
              onClick={handleCreateBracket} 
              disabled={isCreating || !tournament || tournament.status === 'upcoming'}
              className="font-semibold px-8 h-12 shadow-lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              {isCreating ? "Creating..." : "Create a Bracket"}
            </Button>
          )}
          {tournament?.status === 'upcoming' && (
            <p className="mt-4 text-yellow-400 font-medium text-sm">
              The tournament field is not set yet. Check back soon!
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Brackets */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold font-heading text-foreground">My Brackets</h2>
          </div>

          {loadingBrackets ? (
            <div className="space-y-4">
              {[1, 2].map(i => (
                <Card key={i} className="animate-pulse h-40 bg-gray-100" />
              ))}
            </div>
          ) : brackets && brackets.length > 0 ? (
            <div className="space-y-4">
              {brackets.map(bracket => (
                <Card key={bracket.id} className="hover:shadow-md transition-shadow border-l-4 border-l-primary overflow-hidden relative group">
                  {!isLocked && !bracket.submitted && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={(e) => handleDeleteBracket(e, bracket.id)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                  <div className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-xl font-bold font-heading">{bracket.name}</h3>
                          {bracket.submitted ? (
                            <Badge variant="success">Submitted</Badge>
                          ) : (
                            <Badge variant="secondary">In Progress</Badge>
                          )}
                        </div>
                        {bracket.championName ? (
                          <p className="text-sm text-muted-foreground flex items-center">
                            <Trophy className="w-4 h-4 mr-1 text-yellow-500" /> 
                            Pick: <span className="font-semibold text-foreground ml-1">{bracket.championName}</span>
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">Champion not picked yet</p>
                        )}
                      </div>
                      
                      <div className="flex flex-row sm:flex-col gap-4 sm:gap-1 text-right sm:pr-8">
                        <div className="text-center sm:text-right">
                          <div className="text-sm text-muted-foreground">Score</div>
                          <div className="font-bold text-xl">{bracket.score} <span className="text-sm font-normal text-muted-foreground">pts</span></div>
                        </div>
                        <div className="text-center sm:text-right hidden sm:block">
                          <div className="text-sm text-muted-foreground">Max Possible</div>
                          <div className="font-semibold text-sm">{bracket.maxPossibleScore} pts</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-6">
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium">{bracket.completedPicks}/63 Picks Made</span>
                          <span className="text-muted-foreground">{Math.round((bracket.completedPicks/63)*100)}%</span>
                        </div>
                        <Progress value={(bracket.completedPicks/63)*100} className="h-2" />
                      </div>
                      <Link href={`/brackets/${bracket.id}`}>
                        <Button variant={isLocked ? "outline" : "default"} size="sm">
                          {isLocked ? "View Bracket" : bracket.submitted ? "Edit Bracket" : "Continue Picking"}
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center border-dashed border-2">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold mb-2">No brackets yet</h3>
              <p className="text-muted-foreground mb-6">Create your first bracket and start making your picks before the tournament begins.</p>
              <Button onClick={handleCreateBracket} disabled={isCreating || !tournament || tournament.status === 'upcoming'}>
                <Plus className="w-4 h-4 mr-2" /> Create Bracket
              </Button>
            </Card>
          )}
        </div>

        {/* Right Column - Groups */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold font-heading text-foreground">My Groups</h2>
            <Link href="/groups">
              <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">View All</Button>
            </Link>
          </div>

          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-lg font-heading flex items-center">
                <Users className="w-5 h-5 mr-2 text-primary" />
                Active Groups
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingGroups ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Loading groups...</div>
              ) : groups && groups.length > 0 ? (
                <div className="divide-y">
                  {groups.slice(0, 3).map(group => (
                    <Link key={group.id} href={`/groups/${group.id}`}>
                      <div className="p-4 hover:bg-gray-50 transition-colors cursor-pointer flex items-center justify-between group">
                        <div>
                          <div className="font-semibold">{group.name}</div>
                          <div className="text-xs text-muted-foreground">{group.memberCount} members</div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-primary transition-colors" />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <p className="text-sm text-muted-foreground mb-4">You haven't joined any groups yet.</p>
                  <Link href="/groups">
                    <Button variant="outline" size="sm" className="w-full">
                      Join or Create a Group
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
