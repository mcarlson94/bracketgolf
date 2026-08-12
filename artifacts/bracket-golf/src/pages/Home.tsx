import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useGetTournament } from "@workspace/api-client-react";
import { format } from "date-fns";

export default function Home() {
  const { data: tournament, isLoading } = useGetTournament();
  const isLocked = tournament?.status === 'locked' || tournament?.status === 'completed';

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      
      {/* Hero — USGA championship style */}
      <section className="bg-secondary text-secondary-foreground relative overflow-hidden">
        {/* Subtle halftone-dot texture */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 0)', backgroundSize: '24px 24px' }}
        />

        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-16 sm:py-24 relative z-10">
          {/* Overline badge */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-px bg-primary" />
            <span className="text-xs font-semibold tracking-widest uppercase text-primary">
              Fantasy Bracket Contest
            </span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-bold leading-[1.08] tracking-tight text-white mb-4">
            United States<br/>
            Amateur Championship<br/>
            <span className="text-primary">Bracket Challenge</span>
          </h1>

          <p className="text-base sm:text-lg text-white/60 mb-10 max-w-xl leading-relaxed">
            Pick the winner of every match play round at Merion. Compete against friends and prove you know who'll lift the Havemeyer Trophy.
          </p>

          <div className="flex flex-wrap gap-4 items-center">
            <Link href="/login">
              <Button size="lg" className="h-11 px-7 rounded-sm font-semibold text-sm tracking-wide">
                {isLocked ? "View Your Bracket" : "Make Your Picks"}
              </Button>
            </Link>
            <Link href="/leaderboard">
              <Button size="lg" variant="outline" className="h-11 px-7 rounded-sm font-semibold text-sm tracking-wide border-white/20 text-white hover:bg-white/10">
                View Leaderboard
              </Button>
            </Link>
          </div>

          {!isLoading && tournament?.lockTime && !isLocked && (
            <p className="mt-6 text-xs text-white/40 font-medium uppercase tracking-wide">
              Picks lock · {format(new Date(tournament.lockTime), "MMMM d, yyyy 'at' h:mm a")}
            </p>
          )}
        </div>

        {/* Decorative bracket lines */}
        <div className="absolute right-0 top-0 bottom-0 w-64 sm:w-96 opacity-[0.06] pointer-events-none flex items-center">
          <svg viewBox="0 0 200 400" className="h-full w-full" fill="none" stroke="white" strokeWidth="1.5">
            <line x1="40" y1="40" x2="40" y2="180" />
            <line x1="40" y1="110" x2="90" y2="110" />
            <line x1="40" y1="220" x2="40" y2="360" />
            <line x1="40" y1="290" x2="90" y2="290" />
            <line x1="90" y1="110" x2="90" y2="290" />
            <line x1="90" y1="200" x2="140" y2="200" />
            <circle cx="140" cy="200" r="4" fill="white" />
          </svg>
        </div>
      </section>

      {/* Info strip — USGA-style horizontal stats bar */}
      <section className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-6 sm:px-10">
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border">
            {[
              { label: "Field", value: "64 Players" },
              { label: "Format", value: "Match Play" },
              { label: "Rounds", value: "6 Rounds" },
              { label: "Venue", value: "Merion GC" },
            ].map(({ label, value }) => (
              <div key={label} className="py-5 px-4 sm:px-6 text-center">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">{label}</div>
                <div className="text-base font-bold text-foreground">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-6 sm:px-10 bg-background">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-8 h-px bg-primary" />
            <h2 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">How It Works</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { n: "01", title: "Sign Up", desc: "Create a free account in seconds — just your name." },
              { n: "02", title: "Make Picks", desc: "Choose winners for all 63 matches in the single-elimination bracket." },
              { n: "03", title: "Join Groups", desc: "Create private groups to compete against friends or your club." },
              { n: "04", title: "Track Results", desc: "Earn points as real match results come in, updated automatically." },
            ].map(({ n, title, desc }) => (
              <div key={n} className="border-t-2 border-border pt-5">
                <div className="text-2xl font-bold text-primary/20 mb-2 font-heading">{n}</div>
                <h3 className="font-bold text-sm mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Scoring table */}
      <section className="py-16 px-6 sm:px-10 bg-white border-t">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-8 h-px bg-primary" />
            <h2 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">Scoring System</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-border rounded overflow-hidden border">
            {[
              { round: "R64", pts: "1 pt" },
              { round: "R32", pts: "2 pts" },
              { round: "R16", pts: "4 pts" },
              { round: "QF", pts: "8 pts" },
              { round: "SF", pts: "16 pts" },
              { round: "Final", pts: "32 pts" },
            ].map(({ round, pts }) => (
              <div key={round} className="bg-white p-5 text-center">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{round}</div>
                <div className="text-lg font-bold text-foreground">{pts}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">Points double each round. Correct picks in later rounds are worth significantly more.</p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 sm:px-10 bg-secondary text-white text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl font-bold mb-3">Ready to compete?</h2>
          <p className="text-white/60 mb-7 text-sm">It's free. Just pick your winners and see how you stack up.</p>
          <Link href="/login">
            <Button size="lg" className="h-11 px-8 rounded-sm font-semibold">
              Get Started
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
