import { useState } from "react";
import { 
  useGetTournament, 
  useAdminImport, 
  useAdminUpdateTournament,
  useAdminRescore,
  TournamentUpdateStatus
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Settings, RefreshCw, Calculator, ShieldAlert, Upload } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Admin() {
  const queryClient = useQueryClient();
  const { data: tournament, isLoading } = useGetTournament();
  const importMutation = useAdminImport();
  const updateMutation = useAdminUpdateTournament();
  const rescoreMutation = useAdminRescore();

  const [lockTime, setLockTime] = useState("");
  const [status, setStatus] = useState<TournamentUpdateStatus | "">("");

  // Initialize form state when tournament loads
  if (tournament && !lockTime && !status) {
    if (tournament.lockTime) {
      // simple format to datetime-local expected string YYYY-MM-DDThh:mm
      const d = new Date(tournament.lockTime);
      setLockTime(d.toISOString().slice(0, 16));
    }
    setStatus(tournament.status as TournamentUpdateStatus);
  }

  const handleImport = (action: 'import' | 'refresh') => {
    importMutation.mutate(
      { data: { action } },
      {
        onSuccess: (result) => {
          toast({
            title: action === 'import' ? "Import Successful" : "Refresh Successful",
            description: result.message
          });
          queryClient.invalidateQueries({ queryKey: ["/api/tournament"] });
          queryClient.invalidateQueries({ queryKey: ["/api/tournament/matchups"] });
        },
        onError: (err: any) => {
          toast({
            title: "Action Failed",
            description: err.message,
            variant: "destructive"
          });
        }
      }
    );
  };

  const handleUpdate = () => {
    if (!status) return;
    
    const isoLockTime = lockTime ? new Date(lockTime).toISOString() : null;

    updateMutation.mutate(
      { data: { status, lockTime: isoLockTime } },
      {
        onSuccess: () => {
          toast({ title: "Tournament Updated" });
          queryClient.invalidateQueries({ queryKey: ["/api/tournament"] });
        },
        onError: () => {
          toast({ title: "Update Failed", variant: "destructive" });
        }
      }
    );
  };

  const handleRescore = () => {
    rescoreMutation.mutate(
      undefined,
      {
        onSuccess: (res) => {
          toast({ 
            title: "Rescore Complete", 
            description: `Successfully rescored ${res.bracketsRescored} brackets.` 
          });
        },
        onError: () => {
          toast({ title: "Rescore Failed", variant: "destructive" });
        }
      }
    );
  };

  if (isLoading) return <div className="p-10 text-center">Loading...</div>;
  if (!tournament) return <div className="p-10 text-center">Tournament not found</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
      <div className="flex items-center gap-3 border-b pb-4">
        <Settings className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold font-heading">Tournament Administration</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Status & Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Settings</CardTitle>
            <CardDescription>Manage tournament state and lock times.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded border">
              <span className="font-semibold">Current Status</span>
              <Badge variant={tournament.status === 'active' ? 'success' : 'secondary'} className="uppercase">
                {tournament.status}
              </Badge>
            </div>

            <div className="space-y-4 border-t pt-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Update Status</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TournamentUpdateStatus)}
                >
                  <option value="upcoming">Upcoming (Pre-field)</option>
                  <option value="active">Active (Picks Open)</option>
                  <option value="locked">Locked (Tournament Live)</option>
                  <option value="completed">Completed (Tournament Over)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold">Picks Lock Time</label>
                <Input 
                  type="datetime-local" 
                  value={lockTime}
                  onChange={(e) => setLockTime(e.target.value)}
                />
              </div>

              <Button 
                onClick={handleUpdate} 
                disabled={updateMutation.isPending}
                className="w-full"
              >
                Save Settings
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Data Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl text-destructive flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" />
              Data Actions
            </CardTitle>
            <CardDescription>Import data and trigger rescoring. These actions directly affect user brackets.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">USGA Data Sync</h3>
              <p className="text-xs text-muted-foreground mb-2">
                Last sync: {tournament.lastSyncedAt ? format(new Date(tournament.lastSyncedAt), 'PPpp') : 'Never'}
              </p>
              
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => handleImport('import')}
                  disabled={importMutation.isPending}
                  className="flex flex-col h-auto py-3 gap-1"
                >
                  <Upload className="w-5 h-5" />
                  <span>Initial Import</span>
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={() => handleImport('refresh')}
                  disabled={importMutation.isPending}
                  className="flex flex-col h-auto py-3 gap-1"
                >
                  <RefreshCw className="w-5 h-5" />
                  <span>Refresh Results</span>
                </Button>
              </div>
            </div>

            <div className="space-y-3 border-t pt-4">
              <h3 className="font-semibold text-sm">Leaderboard Rescore</h3>
              <p className="text-xs text-muted-foreground mb-2">
                Forces a recalculation of all bracket scores and updates the global leaderboard. Run this after refreshing results.
              </p>
              <Button 
                variant="destructive" 
                onClick={handleRescore}
                disabled={rescoreMutation.isPending}
                className="w-full font-bold"
              >
                <Calculator className="w-4 h-4 mr-2" />
                Rescore All Brackets
              </Button>
            </div>

          </CardContent>
        </Card>

      </div>
    </div>
  );
}
