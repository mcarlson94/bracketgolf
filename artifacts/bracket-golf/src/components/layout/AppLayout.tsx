import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1">
        {children}
      </main>
      <footer className="border-t py-8 bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p className="font-heading font-semibold text-foreground mb-2">Bracket Golf &copy; 2026</p>
          <p>Not affiliated with the USGA. For entertainment purposes only.</p>
        </div>
      </footer>
    </div>
  );
}
