import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useGetTournament } from "@workspace/api-client-react";
import { format } from "date-fns";
import logoSrc from "@/assets/logo.png";
import { Trophy, Users, Target, TrendingUp, ChevronRight, MapPin, Calendar, Flag } from "lucide-react";

export default function Home() {
  const { data: tournament, isLoading } = useGetTournament();
  const isLocked = tournament?.status === "locked" || tournament?.status === "completed";
  const isActive = tournament?.status === "active" || tournament?.status === "locked";

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className="bg-secondary relative overflow-hidden">
        {/* Dot texture */}
        <div
          className="absolute inset-0 opacity-[0.035] pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 0)", backgroundSize: "20px 20px" }}
        />
        {/* Decorative bracket lines top-right */}
        <div className="absolute right-0 top-0 bottom-0 w-56 sm:w-80 opacity-[0.07] pointer-events-none flex items-center">
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

        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-16 sm:py-24 relative z-10">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8 sm:gap-12">

            {/* Logo */}
            <div className="shrink-0">
              <img src={logoSrc} alt="Bracket Golf" className="w-36 h-36 sm:w-44 sm:h-44 object-contain drop-shadow-2xl" />
            </div>

            {/* Text */}
            <div className="text-center sm:text-left">
              <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full border border-green-500/30 bg-green-500/10">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs font-semibold tracking-wider uppercase text-green-400">
                  Season 2026 · Live Now
                </span>
              </div>

              <h1 className="text-5xl sm:text-7xl font-heading font-bold leading-none tracking-tight text-white mb-2 uppercase">
                Bracket
              </h1>
              <h1 className="text-5xl sm:text-7xl font-heading font-bold leading-none tracking-tight text-green-400 mb-5 uppercase">
                Golf
              </h1>

              <p className="text-base sm:text-lg text-white/60 mb-8 max-w-md leading-relaxed font-sans font-normal">
                The fantasy bracket game for elite amateur golf. Pick your winners round by round and prove you know the game.
              </p>

              <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
                <Link href="/login">
                  <Button size="lg" className="h-11 px-7 font-heading font-bold text-base tracking-wide uppercase bg-primary hover:bg-primary/90 text-white rounded">
                    {isLocked ? "View Bracket" : "Make Your Picks"}
                  </Button>
                </Link>
                <Link href="/leaderboard">
                  <Button size="lg" variant="outline" className="h-11 px-7 font-heading font-bold text-base tracking-wide uppercase border-white/20 text-white hover:bg-white/10 rounded">
                    Leaderboard
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────── */}
      <section className="py-14 px-6 sm:px-10 bg-background border-b">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-6 h-0.5 bg-primary" />
            <h2 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground font-sans">
              How It Works
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Users, n: "01", title: "Sign Up Free", desc: "Create your account in seconds — just enter your name." },
              { icon: Target, n: "02", title: "Make Your Picks", desc: "Choose winners for every match play round in the bracket." },
              { icon: TrendingUp, n: "03", title: "Track the Action", desc: "Earn points as real results come in, updated live." },
              { icon: Trophy, n: "04", title: "Win Your Group", desc: "Compete against friends in private groups or the global field." },
            ].map(({ icon: Icon, n, title, desc }) => (
              <div key={n} className="relative pl-5 border-l-2 border-primary/20 hover:border-primary transition-colors">
                <div className="text-3xl font-heading font-bold text-primary/15 mb-3 leading-none">{n}</div>
                <Icon className="w-5 h-5 text-primary mb-2" />
                <h3 className="font-heading font-bold text-base mb-1 uppercase tracking-wide">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed font-sans">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ACTIVE TOURNAMENTS ───────────────────────────────────── */}
      <section className="py-14 px-6 sm:px-10 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-6 h-0.5 bg-primary" />
              <h2 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground font-sans">
                Active Tournaments
              </h2>
            </div>
            {isActive && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Live
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="h-40 rounded-lg bg-muted animate-pulse" />
          ) : tournament ? (
            <Link href="/tournament">
              <div className="group border border-border rounded-lg overflow-hidden hover:border-primary/40 hover:shadow-lg transition-all cursor-pointer bg-white">
                {/* Top accent bar */}
                <div className="h-1.5 bg-gradient-to-r from-secondary via-secondary to-primary" />

                <div className="p-6 sm:p-8">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">

                    {/* Left: info */}
                    <div className="flex items-start gap-5">
                      {/* Shield icon */}
                      <div className="w-14 h-14 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                        <Trophy className="w-7 h-7 text-white" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {isActive && (
                            <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full uppercase tracking-wide">
                              Active
                            </span>
                          )}
                          {tournament.status === "completed" && (
                            <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full uppercase tracking-wide">
                              Completed
                            </span>
                          )}
                          {tournament.status === "upcoming" && (
                            <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full uppercase tracking-wide">
                              Upcoming
                            </span>
                          )}
                        </div>
                        <h3 className="font-heading font-bold text-xl sm:text-2xl uppercase tracking-tight text-foreground">
                          {tournament.name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground font-sans">
                          {tournament.venue && (
                            <span className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-primary" />
                              {tournament.venue}
                            </span>
                          )}
                          {tournament.startDate && tournament.endDate && (
                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-primary" />
                              {format(new Date(tournament.startDate), "MMM d")}–{format(new Date(tournament.endDate), "d, yyyy")}
                            </span>
                          )}
                          <span className="flex items-center gap-1.5">
                            <Flag className="w-3.5 h-3.5 text-primary" />
                            64 Players · Match Play · 6 Rounds
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: CTA */}
                    <div className="sm:text-right shrink-0">
                      <div className="inline-flex items-center gap-2 font-heading font-bold text-sm uppercase tracking-wide text-primary group-hover:gap-3 transition-all">
                        {isLocked ? "View Bracket" : "Make Your Picks"}
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  {/* Scoring strip */}
                  <div className="mt-6 pt-5 border-t border-border">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground font-sans">
                        Points per Round
                      </span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { round: "R64", pts: "1" },
                        { round: "R32", pts: "2" },
                        { round: "R16", pts: "4" },
                        { round: "QF", pts: "8" },
                        { round: "SF", pts: "16" },
                        { round: "Final", pts: "32" },
                      ].map(({ round, pts }) => (
                        <div key={round} className="flex flex-col items-center bg-muted rounded px-3 py-2 min-w-[52px]">
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide font-sans">{round}</span>
                          <span className="text-base font-heading font-bold text-foreground leading-tight">{pts}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ) : (
            <div className="text-center py-16 border border-dashed border-border rounded-lg">
              <Trophy className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-semibold text-muted-foreground">No active tournaments right now</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Check back soon for upcoming bracket challenges.</p>
            </div>
          )}
        </div>
      </section>

      {/* ── BOTTOM CTA ───────────────────────────────────────────── */}
      <section className="py-16 px-6 sm:px-10 bg-secondary text-white text-center">
        <div className="max-w-xl mx-auto">
          <img src={logoSrc} alt="" className="w-16 h-16 object-contain mx-auto mb-5 opacity-90" />
          <h2 className="font-heading text-3xl font-bold uppercase tracking-tight mb-2">
            Ready to compete?
          </h2>
          <p className="text-white/60 mb-7 text-sm font-sans">
            Free to play. Just pick your winners and see how you stack up.
          </p>
          <Link href="/login">
            <Button size="lg" className="h-11 px-10 rounded font-heading font-bold text-base uppercase tracking-wide bg-primary hover:bg-primary/90 text-white">
              Get Started
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
