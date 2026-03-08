"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Hero from "@/components/landing/Hero";
import FeatureGrid from "@/components/landing/FeatureGrid";
import PricingCards from "@/components/landing/PricingCards";

export default function Home() {
  const { user, loading: isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/dashboard");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "var(--bg-primary)" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-primary)" }}>
      {/* Fixed header */}
      <nav
        className="fixed top-0 right-0 left-0 z-50 flex items-center justify-between px-6 py-4 backdrop-blur-md"
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.8)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Seniora" className="w-8 h-8 rounded-lg object-cover" />
          <span className="text-2xl font-bold" style={{ color: "var(--accent)" }}>
            Seniora
          </span>
        </div>
        <Link
          href="/login"
          className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:opacity-80"
          style={{
            borderColor: "var(--border-default)",
            color: "var(--text-primary)",
          }}
        >
          Sign In
        </Link>
      </nav>

      {/* Hero */}
      <Hero />

      {/* Features */}
      <FeatureGrid />

      {/* Pricing */}
      <PricingCards />

      {/* Footer */}
      <footer
        className="border-t px-6 py-8 text-center"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Seniora" className="w-6 h-6 rounded object-cover" />
          <span className="text-lg font-bold" style={{ color: "var(--accent)" }}>
            Seniora
          </span>
        </div>
        <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
          &copy; 2026 Seniora. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
