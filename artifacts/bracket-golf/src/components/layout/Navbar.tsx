import { Link, useLocation } from "wouter";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";

export function Navbar() {
  const { data: user } = useGetMe({ query: { retry: false } });
  const logoutMutation = useLogout();
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        setLocation("/");
      },
    });
  };

  const navLinks = [
    { label: "Leaderboard", href: "/leaderboard", protected: false },
    { label: "Tournament", href: "/tournament", protected: false },
    { label: "Dashboard", href: "/dashboard", protected: true },
    { label: "Groups", href: "/groups", protected: true },
  ];

  return (
    <nav className="bg-secondary text-secondary-foreground sticky top-0 z-50 shadow-sm">
      {/* Top bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14 items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <div className="w-7 h-7 bg-primary rounded-sm flex items-center justify-center">
              <span className="text-white font-bold text-xs tracking-tight">BG</span>
            </div>
            <span className="font-heading font-bold text-base tracking-tight hidden sm:block text-white">
              Bracket Golf
            </span>
          </Link>

          {/* Desktop nav links — underline style */}
          <div className="hidden md:flex items-end gap-6 h-full">
            {navLinks.map((link) => {
              if (link.protected && !user) return null;
              const isActive = location === link.href || location.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`
                    h-full flex items-center text-sm font-medium transition-colors pb-0
                    border-b-2 
                    ${isActive
                      ? "border-primary text-white"
                      : "border-transparent text-white/60 hover:text-white hover:border-white/30"}
                  `}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Right side: auth */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="hidden md:flex items-center gap-4">
                <span className="text-sm text-white/60 font-medium">{user.name}</span>
                <button
                  onClick={handleLogout}
                  className="text-sm text-white/60 hover:text-white transition-colors font-medium"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-4">
                <Link href="/login" className="text-sm text-white/60 hover:text-white transition-colors font-medium">
                  Sign in
                </Link>
                <Link href="/login">
                  <Button size="sm" className="font-semibold h-8 px-4 rounded-sm">
                    Make Your Picks
                  </Button>
                </Link>
              </div>
            )}

            {/* Mobile hamburger */}
            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 h-8 w-8">
                    <Menu className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-secondary text-white border-white/10 rounded-sm">
                  {navLinks.map((link) => {
                    if (link.protected && !user) return null;
                    return (
                      <DropdownMenuItem key={link.href} asChild>
                        <Link href={link.href} className="cursor-pointer text-white/80 hover:text-white">
                          {link.label}
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                  {user ? (
                    <DropdownMenuItem onClick={handleLogout} className="text-red-400 focus:bg-red-400/10 focus:text-red-400 cursor-pointer">
                      Sign out
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem asChild>
                      <Link href="/login" className="cursor-pointer text-primary font-medium">
                        Sign in / Make Picks
                      </Link>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Championship sub-banner (visible on all pages) */}
      <div className="bg-secondary border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5 flex items-center justify-between">
          <span className="text-xs text-white/40 tracking-wide uppercase font-medium">
            2026 U.S. Amateur Championship · Merion Golf Club
          </span>
          <span className="text-xs text-white/30">Aug 10–16, 2026</span>
        </div>
      </div>
    </nav>
  );
}
