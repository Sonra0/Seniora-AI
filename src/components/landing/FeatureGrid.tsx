"use client";

import { FadeIn } from "@/components/ui/PageTransition";

const features = [
  {
    title: "AI Voice Calls",
    description:
      "Natural-sounding AI voice calls in multiple languages that feel like a real conversation, not a robot.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
      </svg>
    ),
  },
  {
    title: "Smart Reminders",
    description:
      "Medication reminders with intelligent retry logic — if a call is missed, it tries again until confirmed.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
  {
    title: "Cognitive Assessment",
    description:
      "Daily voice-based cognitive check-ins that track trends and alert caregivers to changes over time.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
      </svg>
    ),
  },
  {
    title: "Caregiver Network",
    description:
      "Instant Telegram alerts and detailed reports keep the entire care team informed and coordinated.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
      </svg>
    ),
  },
];

const techPartners = [
  {
    name: "Google Cloud",
    role: "Infrastructure & Authentication",
    brandColor: "#4285F4",
    logo: (
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor">
        <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/>
      </svg>
    ),
  },
  {
    name: "Gemini AI",
    role: "Conversational Intelligence",
    brandColor: "#8B5CF6",
    logo: (
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor">
        <path d="M12 0C5.352 0 0 5.352 0 12s5.352 12 12 12 12-5.352 12-12S18.648 0 12 0zm0 2.4c5.28 0 9.6 4.32 9.6 9.6s-4.32 9.6-9.6 9.6S2.4 17.28 2.4 12 6.72 2.4 12 2.4zm-1.2 4.8v4.8H6v2.4h4.8V19.2h2.4v-4.8H18v-2.4h-4.8V7.2h-2.4z"/>
      </svg>
    ),
  },
  {
    name: "Firebase",
    role: "Auth & Real-time Data",
    brandColor: "#F59E0B",
    logo: (
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor">
        <path d="M3.89 15.672L6.255.461A.542.542 0 0 1 7.27.288l2.543 4.771zm16.794 3.692l-2.25-14a.54.54 0 0 0-.919-.295L3.316 19.365l7.856 4.427a1.621 1.621 0 0 0 1.588 0zM14.3 7.147l-1.82-3.482a.542.542 0 0 0-.96 0L3.53 17.984z"/>
      </svg>
    ),
  },
  {
    name: "ElevenLabs",
    role: "Human-like Voice Synthesis",
    brandColor: "#000000",
    logo: (
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor">
        <rect x="7" y="2" width="3" height="20" rx="1.5"/>
        <rect x="14" y="2" width="3" height="20" rx="1.5"/>
      </svg>
    ),
  },
  {
    name: "Gemini CLI",
    role: "AI Development Tooling",
    brandColor: "#6366F1",
    logo: (
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor">
        <path d="M7 8l-4 4 4 4M17 8l4 4-4 4M14 4l-4 16"/>
      </svg>
    ),
  },
];

export default function FeatureGrid() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      {/* Powered By */}
      <FadeIn>
        <div className="mb-24">
          <p
            className="text-center text-xs font-semibold uppercase tracking-[0.2em] mb-3"
            style={{ color: "var(--text-muted)" }}
          >
            Built with
          </p>
          <h3
            className="text-center text-2xl font-bold tracking-tight sm:text-3xl mb-4"
            style={{ color: "var(--text-primary)" }}
          >
            Industry-Leading Technology
          </h3>
          <p
            className="mx-auto max-w-xl text-center text-sm mb-12"
            style={{ color: "var(--text-secondary)" }}
          >
            Powered by the <span className="font-semibold" style={{ color: "#4285F4" }}>Google</span> ecosystem and <span className="font-semibold" style={{ color: "#000000" }}>ElevenLabs</span> — the same technology behind the world&apos;s most advanced AI products.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {techPartners.map((partner, i) => (
              <FadeIn key={partner.name} delay={i * 0.08}>
                <div
                  className="group flex flex-col items-center gap-3 rounded-2xl border-2 p-5 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                  style={{
                    borderColor: partner.brandColor + "30",
                    backgroundColor: "var(--card-bg)",
                    borderTopColor: partner.brandColor,
                    borderTopWidth: "3px",
                  }}
                >
                  <div
                    className="transition-colors duration-200"
                    style={{ color: partner.brandColor }}
                  >
                    {partner.logo}
                  </div>
                  <div>
                    <p
                      className="text-sm font-bold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {partner.name}
                    </p>
                    <p
                      className="text-xs mt-0.5 leading-tight"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {partner.role}
                    </p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
          <p
            className="text-center text-xs mt-6"
            style={{ color: "var(--text-muted)" }}
          >
            Created by <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>Antigravity</span> &middot; Powered by Google Cloud, Gemini API, Firebase Auth &amp; ElevenLabs TTS
          </p>
        </div>
      </FadeIn>

      <FadeIn>
        <h2
          className="text-center text-3xl font-bold tracking-tight sm:text-4xl"
          style={{ color: "var(--text-primary)" }}
        >
          Everything your care team needs
        </h2>
        <p
          className="mx-auto mt-4 max-w-2xl text-center text-lg"
          style={{ color: "var(--text-secondary)" }}
        >
          Powerful features designed to keep your loved ones safe and connected.
        </p>
      </FadeIn>

      <div className="mt-16 grid gap-6 sm:grid-cols-2">
        {features.map((feature, i) => (
          <FadeIn key={feature.title} delay={i * 0.1}>
            <div
              className="group rounded-2xl border p-6 transition-all duration-200 hover:border-[var(--accent)] hover:-translate-y-1"
              style={{
                borderColor: "var(--border-default)",
                backgroundColor: "var(--card-bg)",
              }}
            >
              <div
                className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl transition-colors duration-200 group-hover:bg-[var(--accent)] group-hover:text-white"
                style={{
                  backgroundColor: "var(--accent-light)",
                  color: "var(--accent)",
                }}
              >
                {feature.icon}
              </div>
              <h3
                className="text-lg font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {feature.title}
              </h3>
              <p
                className="mt-2 text-sm leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                {feature.description}
              </p>
            </div>
          </FadeIn>
        ))}
      </div>
    </section>
  );
}
