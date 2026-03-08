"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Subtle grid background */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(var(--accent) 1px, transparent 1px), linear-gradient(90deg, var(--accent) 1px, transparent 1px)`,
          backgroundSize: "64px 64px",
          opacity: 0.03,
        }}
      />

      <div className="relative mx-auto max-w-4xl px-6 py-32 text-center">
        {/* Pill badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0 }}
        >
          <span className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium" style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}>
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--accent)" }} />
            AI-Powered Elderly Care
          </span>
        </motion.div>

        {/* Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
          className="mt-8 text-5xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl"
          style={{ color: "var(--text-primary)" }}
        >
          Care that calls.
          <br />
          <span style={{ color: "var(--accent)" }}>Literally.</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
          className="mx-auto mt-6 max-w-2xl text-lg leading-8"
          style={{ color: "var(--text-secondary)" }}
        >
          Automated voice calls that remind your loved ones about medications,
          run cognitive assessments, and keep caregivers informed — all powered
          by AI.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.3 }}
          className="mt-10 flex items-center justify-center gap-4"
        >
          <Link
            href="/login?plan=free"
            className="rounded-xl border px-6 py-3 text-base font-semibold transition-colors hover:opacity-80"
            style={{
              borderColor: "var(--border-default)",
              color: "var(--text-primary)",
              backgroundColor: "var(--bg-primary)",
            }}
          >
            Start Free
          </Link>
          <Link
            href="/login?plan=premium"
            className="rounded-xl px-6 py-3 text-base font-semibold text-white transition-colors hover:opacity-90"
            style={{
              backgroundColor: "var(--accent)",
              boxShadow: "0 4px 14px rgba(79, 70, 229, 0.4)",
            }}
          >
            Get Premium — $10/mo
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
