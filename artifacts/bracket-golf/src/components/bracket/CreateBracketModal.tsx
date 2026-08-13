import { useState } from "react";
import { useLogin, useCreateBracket, useGetMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Flag, Trophy } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface CreateBracketModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (bracketId: string) => void;
  defaultStartRound?: "R64" | "R32";
  bracketCount?: number;
}

export function CreateBracketModal({
  open,
  onOpenChange,
  onCreated,
  defaultStartRound = "R64",
  bracketCount = 0,
}: CreateBracketModalProps) {
  const queryClient = useQueryClient();
  const { data: currentUser } = useGetMe({ query: { retry: false } });

  const [yourName, setYourName] = useState(currentUser?.name ?? "");
  const [bracketName, setBracketName] = useState(
    defaultStartRound === "R32"
      ? `R32 Bracket ${bracketCount + 1}`
      : `My Bracket ${bracketCount + 1}`
  );
  const [startRound, setStartRound] = useState<"R64" | "R32">(defaultStartRound);
  const [busy, setBusy] = useState(false);

  const loginMutation = useLogin();
  const createBracketMutation = useCreateBracket();

  // Reset fields when modal opens
  const handleOpenChange = (val: boolean) => {
    if (val) {
      setYourName(currentUser?.name ?? "");
      setBracketName(
        startRound === "R32"
          ? `R32 Bracket ${bracketCount + 1}`
          : `My Bracket ${bracketCount + 1}`
      );
    }
    onOpenChange(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = yourName.trim();
    const bName = bracketName.trim();
    if (!name) {
      toast({ title: "Please enter your name.", variant: "destructive" });
      return;
    }
    if (!bName) {
      toast({ title: "Please enter a bracket name.", variant: "destructive" });
      return;
    }

    setBusy(true);
    try {
      // Step 1: login (creates or resumes the user by name)
      await new Promise<void>((resolve, reject) => {
        loginMutation.mutate(
          { data: { name } },
          {
            onSuccess: () => {
              queryClient.resetQueries({ queryKey: ["/api/auth/me"] });
              resolve();
            },
            onError: reject,
          }
        );
      });

      // Step 2: create the bracket
      await new Promise<void>((resolve, reject) => {
        createBracketMutation.mutate(
          { data: { name: bName, startRound } },
          {
            onSuccess: (newBracket) => {
              queryClient.invalidateQueries({ queryKey: ["/api/brackets"] });
              onCreated(newBracket.id);
              onOpenChange(false);
              resolve();
            },
            onError: reject,
          }
        );
      });
    } catch (err: any) {
      const isHtmlResponse =
        err?.message?.includes("parse") || err?.name === "ResponseParseError";
      toast({
        title: "Couldn't reach the server",
        description: isHtmlResponse
          ? "The API isn't connected. If you're the site owner, set API_URL in Railway."
          : err?.message || "Couldn't create your bracket. Please try again.",
        variant: "destructive",
      });
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl uppercase tracking-wide">
            Create Your Bracket
          </DialogTitle>
          <DialogDescription>
            Enter your name and give your bracket a title to get started.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-1">
          {/* Your name */}
          <div className="space-y-1.5">
            <Label htmlFor="yourName">Your Name</Label>
            <Input
              id="yourName"
              placeholder="e.g. Tiger Woods"
              value={yourName}
              onChange={(e) => setYourName(e.target.value)}
              disabled={busy}
              autoFocus
            />
          </div>

          {/* Bracket name */}
          <div className="space-y-1.5">
            <Label htmlFor="bracketName">Bracket Name</Label>
            <Input
              id="bracketName"
              placeholder="e.g. Tiger's Picks"
              value={bracketName}
              onChange={(e) => setBracketName(e.target.value)}
              disabled={busy}
            />
          </div>

          {/* Type toggle */}
          <div className="space-y-1.5">
            <Label>Bracket Type</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStartRound("R64")}
                disabled={busy}
                className={`flex items-center gap-2 rounded border px-4 py-3 text-sm font-semibold transition-colors
                  ${startRound === "R64"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
              >
                <Trophy className="w-4 h-4 shrink-0" />
                Full Bracket (R64)
              </button>
              <button
                type="button"
                onClick={() => setStartRound("R32")}
                disabled={busy}
                className={`flex items-center gap-2 rounded border px-4 py-3 text-sm font-semibold transition-colors
                  ${startRound === "R32"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
              >
                <Flag className="w-4 h-4 shrink-0" />
                Round of 32
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full font-heading font-bold uppercase tracking-wide" disabled={busy}>
            {busy ? "Creating…" : "Create Bracket"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
