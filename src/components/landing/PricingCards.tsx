"use client";

import Link from "next/link";
import { FadeIn } from "@/components/ui/PageTransition";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Get started with essential care features.",
    features: [
      "1 care profile",
      "Medication reminders",
      "Basic scheduling",
      "Telegram notifications",
    ],
    cta: "Start Free",
    href: "/login?plan=free",
    featured: false,
  },
  {
    name: "Premium",
    price: "$10",
    period: "/month",
    description: "Full-featured care for the whole family.",
    features: [
      "Unlimited profiles",
      "AI cognitive assessments",
      "Vocal biomarker analysis",
      "30-day trend reports",
      "Emergency call system",
      "Priority support",
    ],
    cta: "Get Premium",
    href: "/login?plan=premium",
    featured: true,
  },
];

export default function PricingCards() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-24">
      <FadeIn>
        <h2
          className="text-center text-3xl font-bold tracking-tight sm:text-4xl"
          style={{ color: "var(--text-primary)" }}
        >
          Simple, transparent pricing
        </h2>
        <p
          className="mx-auto mt-4 max-w-2xl text-center text-lg"
          style={{ color: "var(--text-secondary)" }}
        >
          Start free and upgrade when you need more.
        </p>
      </FadeIn>

      <div className="mt-16 grid gap-8 sm:grid-cols-2">
        {plans.map((plan, i) => (
          <FadeIn key={plan.name} delay={i * 0.15}>
            <div
              className="relative flex flex-col rounded-2xl border p-8 transition-all duration-200 hover:-translate-y-1"
              style={
                plan.featured
                  ? {
                      backgroundColor: "var(--accent)",
                      borderColor: "var(--accent)",
                    }
                  : {
                      backgroundColor: "var(--card-bg)",
                      borderColor: "var(--border-default)",
                    }
              }
            >
              {plan.featured && (
                <span className="absolute -top-3 left-6 rounded-full bg-white px-3 py-1 text-xs font-semibold" style={{ color: "var(--accent)" }}>
                  Recommended
                </span>
              )}

              <h3
                className="text-lg font-semibold"
                style={{ color: plan.featured ? "#ffffff" : "var(--text-primary)" }}
              >
                {plan.name}
              </h3>

              <div className="mt-4 flex items-baseline gap-1">
                <span
                  className="text-4xl font-extrabold"
                  style={{ color: plan.featured ? "#ffffff" : "var(--text-primary)" }}
                >
                  {plan.price}
                </span>
                <span
                  className="text-sm"
                  style={{ color: plan.featured ? "rgba(255,255,255,0.7)" : "var(--text-muted)" }}
                >
                  {plan.period}
                </span>
              </div>

              <p
                className="mt-2 text-sm"
                style={{ color: plan.featured ? "rgba(255,255,255,0.8)" : "var(--text-secondary)" }}
              >
                {plan.description}
              </p>

              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <svg
                      className="mt-0.5 h-5 w-5 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      style={{ color: plan.featured ? "#ffffff" : "var(--accent)" }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    <span
                      className="text-sm"
                      style={{ color: plan.featured ? "rgba(255,255,255,0.9)" : "var(--text-secondary)" }}
                    >
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href}
                className="mt-8 block rounded-xl py-3 text-center text-sm font-semibold transition-colors hover:opacity-90"
                style={
                  plan.featured
                    ? {
                        backgroundColor: "#ffffff",
                        color: "var(--accent)",
                      }
                    : {
                        backgroundColor: "var(--accent)",
                        color: "#ffffff",
                      }
                }
              >
                {plan.cta}
              </Link>
            </div>
          </FadeIn>
        ))}
      </div>
    </section>
  );
}
