import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useGetTournament } from "@workspace/api-client-react";
import { format } from "date-fns";

export default function Home() {
  const { data: tournament, isLoading } = useGetTournament();

  const isLocked = tournament?.status === 'locked' || tournament?.status === 'completed';

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Hero Section */}
      <section className="bg-secondary text-secondary-foreground py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-5 pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }}>
        </div>
        
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-block mb-4 px-3 py-1 rounded-full border border-white/20 bg-white/5 text-sm font-semibold tracking-wider text-green-400">
            2026 U.S. AMATEUR CHAMPIONSHIP
          </div>
          <h1 className="text-5xl md:text-7xl font-bold font-heading mb-6 tracking-tight leading-tight">
            64 Golfers. 63 Matches. <br/>
            <span className="text-primary">One Champion.</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-10 max-w-2xl mx-auto">
            Test your knowledge of the amateur game. Fill out your bracket, compete against friends, and prove you know who will hoist the Havemeyer Trophy.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/login">
              <Button size="lg" className="text-lg px-8 h-14 font-semibold shadow-lg hover:shadow-primary/25 transition-all">
                {isLocked ? "View Your Bracket" : "Make Your Picks"}
              </Button>
            </Link>
            <Link href="/leaderboard">
              <Button size="lg" variant="outline" className="text-lg px-8 h-14 font-semibold border-white/20 text-white hover:bg-white/10">
                View Leaderboard
              </Button>
            </Link>
          </div>

          {!isLoading && tournament?.lockTime && !isLocked && (
            <p className="mt-8 text-sm text-gray-400 font-medium">
              Picks lock on {format(new Date(tournament.lockTime), "MMMM d, yyyy 'at' h:mm a")}
            </p>
          )}
        </div>
      </section>

      {/* How it Works Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-background">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold font-heading mb-4 text-foreground">How It Works</h2>
            <div className="w-24 h-1 bg-primary mx-auto rounded-full"></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <StepCard 
              number="1"
              title="Sign Up"
              description="Create a free account in seconds. All you need is your name to get started."
            />
            <StepCard 
              number="2"
              title="Make Picks"
              description="Pick the winners for all 63 matches in the single-elimination match play bracket."
            />
            <StepCard 
              number="3"
              title="Join Groups"
              description="Create private groups to compete directly against your friends or country club."
            />
            <StepCard 
              number="4"
              title="Track Results"
              description="Follow the live leaderboard as real tournament results come in and earn points."
            />
          </div>
        </div>
      </section>

      {/* Decorative Bracket Visual */}
      <section className="py-24 bg-gray-50 border-t overflow-hidden relative">
        <div className="max-w-7xl mx-auto px-4 relative z-10 text-center">
          <h2 className="text-4xl font-bold font-heading mb-6">Ready to make your picks?</h2>
          <Link href="/login">
            <Button size="lg" className="h-12 px-8 text-base">Get Started Now</Button>
          </Link>
        </div>
        
        {/* Faded background bracket lines */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none flex items-center justify-center">
          <div className="w-full max-w-5xl h-64 border-y-2 border-l-2 border-black rounded-l-xl mx-auto relative">
            <div className="absolute top-1/2 -right-12 w-12 h-0.5 bg-black"></div>
            <div className="absolute top-0 -left-12 w-12 h-0.5 bg-black"></div>
            <div className="absolute bottom-0 -left-12 w-12 h-0.5 bg-black"></div>
          </div>
        </div>
      </section>
    </div>
  );
}

function StepCard({ number, title, description }: { number: string, title: string, description: string }) {
  return (
    <div className="bg-card border rounded-xl p-6 text-center hover:shadow-md transition-shadow">
      <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xl font-bold font-heading mx-auto mb-4">
        {number}
      </div>
      <h3 className="text-lg font-bold font-heading mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
}
