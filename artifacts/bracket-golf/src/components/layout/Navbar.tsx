import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import logoSrc from "@/assets/logo.png";

export function Navbar() {
  const [location] = useLocation();

  const navLinks = [
    { label: "Home", href: "/" },
    { label: "Dashboard", href: "/dashboard" },
    { label: "Tournament", href: "/tournament" },
  ];

  return (
    <nav className="bg-secondary text-secondary-foreground sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 shrink-0">
            <img src={logoSrc} alt="Bracket Golf" className="h-10 w-10 object-contain" />
            <div className="hidden sm:flex flex-col leading-none">
              <span className="font-heading font-bold text-xl tracking-tight text-white uppercase leading-none">
                Bracket
              </span>
              <span className="font-heading font-bold text-sm tracking-widest text-green-400 uppercase leading-none mt-0.5">
                Golf
              </span>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-stretch h-full gap-1">
            {navLinks.map((link) => {
              const isActive = link.href === "/"
                ? location === "/"
                : location === link.href || location.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`
                    flex items-center px-4 text-sm font-semibold transition-colors border-b-2
                    ${isActive
                      ? "border-green-400 text-white"
                      : "border-transparent text-white/60 hover:text-white hover:border-white/30"}
                  `}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Right: CTA */}
          <div className="flex items-center gap-3">
            <div className="hidden md:block">
              <Link href="/dashboard">
                <Button size="sm" className="font-semibold h-8 px-4 rounded bg-primary hover:bg-primary/90 text-primary-foreground">
                  Make Picks
                </Button>
              </Link>
            </div>

            {/* Mobile hamburger */}
            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 h-9 w-9">
                    <Menu className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 bg-secondary text-white border-white/10 rounded">
                  {navLinks.map((link) => (
                    <DropdownMenuItem key={link.href} asChild>
                      <Link href={link.href} className="cursor-pointer text-white/80 hover:text-white font-medium">
                        {link.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                  <div className="border-t border-white/10 my-1" />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard" className="cursor-pointer text-green-400 font-semibold">
                      Make Picks
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
