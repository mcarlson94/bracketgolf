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
    { label: "Dashboard", href: "/dashboard", protected: true },
    { label: "Leaderboard", href: "/leaderboard", protected: false },
    { label: "Groups", href: "/groups", protected: true },
    { label: "Tournament", href: "/tournament", protected: false },
  ];

  return (
    <nav className="bg-secondary text-secondary-foreground border-b border-white/10 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex-shrink-0 flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold font-heading">
                BG
              </div>
              <span className="font-heading font-bold text-xl tracking-tight hidden sm:block">
                Bracket Golf
              </span>
            </Link>
            
            <div className="hidden md:ml-8 md:flex md:space-x-4">
              {navLinks.map((link) => {
                if (link.protected && !user) return null;
                const isActive = location.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      isActive
                        ? "bg-white/10 text-white"
                        : "text-gray-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {user ? (
              <div className="hidden md:flex items-center gap-4">
                <span className="text-sm font-medium text-gray-300">
                  {user.name}
                </span>
                <Button variant="outline" size="sm" onClick={handleLogout} className="border-white/20 text-white hover:bg-white/10">
                  Sign out
                </Button>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-4">
                <Link href="/login" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
                  Sign in
                </Link>
                <Link href="/login">
                  <Button size="sm" className="font-semibold">
                    Play Now
                  </Button>
                </Link>
              </div>
            )}
            
            <div className="md:hidden flex items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-white">
                    <Menu className="h-6 w-6" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-secondary text-white border-white/10">
                  {navLinks.map((link) => {
                    if (link.protected && !user) return null;
                    return (
                      <DropdownMenuItem key={link.href} asChild>
                        <Link href={link.href} className="cursor-pointer">
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
                      <Link href="/login" className="cursor-pointer text-primary">
                        Sign in / Play Now
                      </Link>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
