# Frontend Rebuild Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the entire Seniora frontend with premium UI/UX, sophisticated medical visualizations, smooth animations, and a market-ready landing page with pricing tiers.

**Architecture:** Next.js App Router with Tailwind CSS for styling, Framer Motion for page/layout animations, nivo (D3-based) for medical charts. Light theme for public pages, dark theme for assessment analytics. All components are custom — no UI library. Existing API endpoints and data fetching logic (`apiFetch`) are preserved; only the presentation layer changes.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, Framer Motion, @nivo/core + radar + line + heatmap + radial-bar, TypeScript

---

## Phase 0: Setup

### Task 1: Install dependencies

**Step 1: Install animation and charting packages**

```bash
npm install framer-motion @nivo/core @nivo/radar @nivo/line @nivo/heatmap @nivo/radial-bar
```

**Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add framer-motion and nivo charting dependencies"
```

---

### Task 2: Create UI primitives and theme system

**Files:**
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/Badge.tsx`
- Create: `src/components/ui/Card.tsx`
- Create: `src/components/ui/Toggle.tsx`
- Create: `src/components/ui/AnimatedNumber.tsx`
- Create: `src/components/ui/PageTransition.tsx`
- Modify: `src/app/globals.css`

**Step 1: Update globals.css with theme variables**

Add CSS custom properties for light and dark themes. The dark theme is scoped to `.theme-dark`:

```css
@import "tailwindcss";

@theme inline {
  --color-background: #ffffff;
  --color-foreground: #0a0a0a;
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

:root {
  /* Light theme (default) */
  --bg-primary: #ffffff;
  --bg-secondary: #f8fafc;
  --bg-tertiary: #f1f5f9;
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #94a3b8;
  --border-default: #e2e8f0;
  --border-subtle: #f1f5f9;
  --accent: #4f46e5;
  --accent-light: #e0e7ff;
  --accent-hover: #4338ca;
  --success: #10b981;
  --success-light: #d1fae5;
  --warning: #f59e0b;
  --warning-light: #fef3c7;
  --danger: #ef4444;
  --danger-light: #fee2e2;
  --card-bg: #ffffff;
  --card-border: #e2e8f0;
  --card-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06);
}

.theme-dark {
  --bg-primary: #0b0f1a;
  --bg-secondary: #111827;
  --bg-tertiary: #1e293b;
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
  --border-default: #1e293b;
  --border-subtle: #1e293b;
  --card-bg: #111827;
  --card-border: #1e293b;
  --card-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

/* Smooth theme transition */
.theme-transition {
  transition: background-color 0.4s ease, color 0.3s ease, border-color 0.3s ease;
}
```

**Step 2: Create Button component**

```tsx
// src/components/ui/Button.tsx
"use client";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  children: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]";

  const variants = {
    primary: "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] shadow-sm",
    secondary:
      "bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--border-default)] border border-[var(--border-default)]",
    ghost: "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]",
    danger: "bg-[var(--danger)] text-white hover:bg-red-600",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
```

**Step 3: Create Badge component**

```tsx
// src/components/ui/Badge.tsx
interface BadgeProps {
  variant?: "default" | "success" | "warning" | "danger" | "accent";
  size?: "sm" | "md";
  pulse?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = "default", size = "sm", pulse = false, children, className = "" }: BadgeProps) {
  const variants = {
    default: "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]",
    success: "bg-[var(--success-light)] text-emerald-700",
    warning: "bg-[var(--warning-light)] text-amber-700",
    danger: "bg-[var(--danger-light)] text-red-700",
    accent: "bg-[var(--accent-light)] text-indigo-700",
  };

  const sizes = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-sm",
  };

  return (
    <span className={`inline-flex items-center font-medium rounded-full ${variants[variant]} ${sizes[size]} ${className}`}>
      {pulse && (
        <span className="relative mr-1.5 flex h-2 w-2">
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${variant === "danger" ? "bg-red-400" : variant === "success" ? "bg-emerald-400" : "bg-indigo-400"}`} />
          <span className={`relative inline-flex h-2 w-2 rounded-full ${variant === "danger" ? "bg-red-500" : variant === "success" ? "bg-emerald-500" : "bg-indigo-500"}`} />
        </span>
      )}
      {children}
    </span>
  );
}
```

**Step 4: Create Card component**

```tsx
// src/components/ui/Card.tsx
interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

export function Card({ children, className = "", hover = false, padding = "md" }: CardProps) {
  const paddings = { none: "", sm: "p-4", md: "p-6", lg: "p-8" };

  return (
    <div
      className={`rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--card-shadow)] theme-transition ${
        hover ? "hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer" : ""
      } ${paddings[padding]} ${className}`}
    >
      {children}
    </div>
  );
}
```

**Step 5: Create Toggle component**

```tsx
// src/components/ui/Toggle.tsx
"use client";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, disabled = false }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? "bg-[var(--accent)]" : "bg-[var(--border-default)]"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}
```

**Step 6: Create AnimatedNumber component**

```tsx
// src/components/ui/AnimatedNumber.tsx
"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  className?: string;
}

export function AnimatedNumber({
  value,
  duration = 1000,
  suffix = "",
  prefix = "",
  decimals = 0,
  className = "",
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number>(0);

  useEffect(() => {
    const start = ref.current;
    const diff = value - start;
    const startTime = performance.now();

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + diff * eased;
      setDisplay(current);
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        ref.current = value;
      }
    }
    requestAnimationFrame(animate);
  }, [value, duration]);

  return (
    <span className={className}>
      {prefix}
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
}
```

**Step 7: Create PageTransition component**

```tsx
// src/components/ui/PageTransition.tsx
"use client";

import { motion, AnimatePresence } from "framer-motion";

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

export function PageTransition({ children, className = "" }: PageTransitionProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export function StaggerContainer({ children, className = "" }: PageTransitionProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.08 } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className = "" }: PageTransitionProps) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 16 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function FadeIn({ children, className = "", delay = 0 }: PageTransitionProps & { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, ease: "easeOut", delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
```

**Step 8: Commit**

```bash
git add src/components/ui/ src/app/globals.css
git commit -m "feat: add UI primitives, theme system, and animation components"
```

---

## Phase 1: Layout Components

### Task 3: Create Sidebar and TopBar layout

**Files:**
- Create: `src/components/layout/Sidebar.tsx`
- Create: `src/components/layout/TopBar.tsx`
- Modify: `src/app/dashboard/layout.tsx`
- Modify: `src/app/elderly/layout.tsx`

**Step 1: Create Sidebar**

The sidebar has nav items, subscription badge, user info, and collapses to a bottom bar on mobile.

```tsx
// src/components/layout/Sidebar.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/Badge";

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
      </svg>
    ),
  },
  {
    label: "Settings",
    href: "/settings",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const plan = "premium"; // TODO: read from user context

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex flex-col fixed left-0 top-0 h-screen bg-[var(--bg-primary)] border-r border-[var(--border-default)] z-40 transition-all duration-300 ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 h-16 border-b border-[var(--border-default)]">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          {!collapsed && <span className="font-semibold text-[var(--text-primary)]">Seniora</span>}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  active
                    ? "bg-[var(--accent-light)] text-[var(--accent)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {item.icon}
                {!collapsed && item.label}
              </Link>
            );
          })}
        </nav>

        {/* Subscription */}
        {!collapsed && (
          <div className="px-4 py-3 border-t border-[var(--border-default)]">
            <Badge variant={plan === "premium" ? "success" : "default"} size="sm" pulse={plan === "premium"}>
              {plan === "premium" ? "Premium — Active" : "Free Plan"}
            </Badge>
          </div>
        )}

        {/* User + Collapse */}
        <div className="px-3 py-3 border-t border-[var(--border-default)] space-y-2">
          {!collapsed && user && (
            <div className="flex items-center gap-2 px-2">
              <div className="w-7 h-7 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-xs font-medium text-[var(--text-secondary)]">
                {user.displayName?.[0] || user.email?.[0] || "U"}
              </div>
              <span className="text-sm text-[var(--text-secondary)] truncate">{user.displayName || user.email}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="flex-1 flex items-center justify-center py-2 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
            >
              <svg className={`w-4 h-4 transition-transform ${collapsed ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
              </svg>
            </button>
            {!collapsed && (
              <button
                onClick={logout}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--danger)] transition-colors"
              >
                Sign Out
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile bottom bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--bg-primary)] border-t border-[var(--border-default)] z-40 flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-xs transition-colors ${
                active ? "text-[var(--accent)]" : "text-[var(--text-muted)]"
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button
          onClick={logout}
          className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-xs text-[var(--text-muted)]"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
          </svg>
          <span>Sign Out</span>
        </button>
      </nav>
    </>
  );
}
```

**Step 2: Create TopBar**

```tsx
// src/components/layout/TopBar.tsx
"use client";

interface TopBarProps {
  title?: string;
  children?: React.ReactNode;
}

export function TopBar({ title, children }: TopBarProps) {
  return (
    <header className="flex items-center justify-between h-16 px-6 border-b border-[var(--border-default)] bg-[var(--bg-primary)]">
      {title && <h1 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h1>}
      <div className="flex items-center gap-3">
        {children}
      </div>
    </header>
  );
}
```

**Step 3: Update dashboard layout**

Replace `src/app/dashboard/layout.tsx`:

```tsx
import { Sidebar } from "@/components/layout/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg-secondary)]">
      <Sidebar />
      <main className="md:ml-60 pb-20 md:pb-0">
        {children}
      </main>
    </div>
  );
}
```

**Step 4: Update elderly layout**

Replace `src/app/elderly/layout.tsx`:

```tsx
import { Sidebar } from "@/components/layout/Sidebar";

export default function ElderlyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg-secondary)]">
      <Sidebar />
      <main className="md:ml-60 pb-20 md:pb-0">
        {children}
      </main>
    </div>
  );
}
```

**Step 5: Commit**

```bash
git add src/components/layout/ src/app/dashboard/layout.tsx src/app/elderly/layout.tsx
git commit -m "feat: add sidebar navigation and layout system"
```

---

## Phase 2: Landing Page

### Task 4: Rebuild landing page

**Files:**
- Create: `src/components/landing/Hero.tsx`
- Create: `src/components/landing/PricingCards.tsx`
- Create: `src/components/landing/FeatureGrid.tsx`
- Modify: `src/app/page.tsx`

**Step 1: Create Hero component**

```tsx
// src/components/landing/Hero.tsx
"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export function Hero() {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-[var(--bg-primary)]">
      {/* Subtle grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(79,70,229,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(79,70,229,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />

      <div className="relative max-w-4xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--accent-light)] text-[var(--accent)] text-sm font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
            AI-Powered Elderly Care
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
          className="text-5xl sm:text-6xl lg:text-7xl font-bold text-[var(--text-primary)] tracking-tight leading-[1.1]"
        >
          Care that calls.
          <br />
          <span className="text-[var(--accent)]">Literally.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          className="mt-6 text-lg sm:text-xl text-[var(--text-secondary)] max-w-2xl mx-auto leading-relaxed"
        >
          Automated voice calls for medication reminders, cognitive assessments,
          and emotional check-ins. Professional-grade health monitoring for the
          people you love.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href="/login?plan=free"
            className="px-8 py-3.5 rounded-xl border border-[var(--border-default)] text-[var(--text-primary)] font-medium hover:bg-[var(--bg-tertiary)] transition-all duration-200 text-base"
          >
            Start Free
          </Link>
          <Link
            href="/login?plan=premium"
            className="px-8 py-3.5 rounded-xl bg-[var(--accent)] text-white font-medium hover:bg-[var(--accent-hover)] transition-all duration-200 shadow-lg shadow-indigo-500/20 text-base"
          >
            Get Premium — $10/mo
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
```

**Step 2: Create PricingCards component**

```tsx
// src/components/landing/PricingCards.tsx
"use client";

import Link from "next/link";
import { FadeIn } from "@/components/ui/PageTransition";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Basic care reminders for one profile",
    features: [
      "1 elderly profile",
      "Medication reminders",
      "Basic call scheduling",
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
    description: "Full AI-powered care with cognitive monitoring",
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

export function PricingCards() {
  return (
    <section className="py-24 px-6 bg-[var(--bg-secondary)]">
      <FadeIn>
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)]">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg text-[var(--text-secondary)]">
            Start free, upgrade when you need advanced monitoring.
          </p>
        </div>
      </FadeIn>

      <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-6">
        {plans.map((plan, i) => (
          <FadeIn key={plan.name} delay={i * 0.1}>
            <div
              className={`relative rounded-2xl p-8 transition-all duration-300 hover:-translate-y-1 ${
                plan.featured
                  ? "bg-[var(--accent)] text-white shadow-xl shadow-indigo-500/20 ring-1 ring-indigo-400/30"
                  : "bg-[var(--card-bg)] border border-[var(--card-border)] shadow-[var(--card-shadow)]"
              }`}
            >
              {plan.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white text-[var(--accent)] text-xs font-semibold shadow-sm">
                  Recommended
                </span>
              )}

              <h3 className={`text-lg font-semibold ${plan.featured ? "text-white" : "text-[var(--text-primary)]"}`}>
                {plan.name}
              </h3>

              <div className="mt-4 flex items-baseline gap-1">
                <span className={`text-4xl font-bold ${plan.featured ? "text-white" : "text-[var(--text-primary)]"}`}>
                  {plan.price}
                </span>
                <span className={`text-sm ${plan.featured ? "text-indigo-100" : "text-[var(--text-muted)]"}`}>
                  {plan.period}
                </span>
              </div>

              <p className={`mt-2 text-sm ${plan.featured ? "text-indigo-100" : "text-[var(--text-secondary)]"}`}>
                {plan.description}
              </p>

              <ul className="mt-6 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <svg className={`w-4 h-4 shrink-0 ${plan.featured ? "text-indigo-200" : "text-[var(--success)]"}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    <span className={plan.featured ? "text-indigo-50" : "text-[var(--text-secondary)]"}>{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href}
                className={`mt-8 block w-full py-3 rounded-xl text-center text-sm font-medium transition-all duration-200 ${
                  plan.featured
                    ? "bg-white text-[var(--accent)] hover:bg-indigo-50"
                    : "bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--border-default)] border border-[var(--border-default)]"
                }`}
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
```

**Step 3: Create FeatureGrid component**

```tsx
// src/components/landing/FeatureGrid.tsx
"use client";

import { FadeIn } from "@/components/ui/PageTransition";

const features = [
  {
    title: "AI Voice Calls",
    description: "Natural-sounding calls powered by ElevenLabs voice synthesis. Your loved one hears a familiar, warm voice.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
      </svg>
    ),
  },
  {
    title: "Smart Reminders",
    description: "Medication and task reminders with intelligent retry logic. Missed calls are automatically reattempted.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
  {
    title: "Cognitive Assessment",
    description: "Daily voice-based cognitive check-ins with scoring, trend analysis, and vocal biomarker monitoring.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
      </svg>
    ),
  },
  {
    title: "Caregiver Network",
    description: "Connect multiple caregivers via Telegram. Real-time alerts and detailed reports delivered instantly.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
      </svg>
    ),
  },
];

export function FeatureGrid() {
  return (
    <section className="py-24 px-6 bg-[var(--bg-primary)]">
      <FadeIn>
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)]">
            Everything you need
          </h2>
          <p className="mt-4 text-lg text-[var(--text-secondary)]">
            Professional-grade care monitoring, delivered through simple phone calls.
          </p>
        </div>
      </FadeIn>

      <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-6">
        {features.map((f, i) => (
          <FadeIn key={f.title} delay={i * 0.1}>
            <div className="group rounded-2xl border border-[var(--border-default)] bg-[var(--card-bg)] p-6 transition-all duration-300 hover:border-[var(--accent)] hover:shadow-md">
              <div className="w-10 h-10 rounded-xl bg-[var(--accent-light)] flex items-center justify-center text-[var(--accent)] group-hover:bg-[var(--accent)] group-hover:text-white transition-colors duration-300">
                {f.icon}
              </div>
              <h3 className="mt-4 text-base font-semibold text-[var(--text-primary)]">{f.title}</h3>
              <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">{f.description}</p>
            </div>
          </FadeIn>
        ))}
      </div>
    </section>
  );
}
```

**Step 4: Rebuild the landing page**

Replace `src/app/page.tsx`:

```tsx
"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { Hero } from "@/components/landing/Hero";
import { FeatureGrid } from "@/components/landing/FeatureGrid";
import { PricingCards } from "@/components/landing/PricingCards";

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.push("/dashboard");
  }, [user, loading, router]);

  if (loading || user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--accent)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Minimal top bar */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-[var(--bg-primary)]/80 border-b border-[var(--border-subtle)]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[var(--accent)] flex items-center justify-center">
              <span className="text-white font-bold text-xs">S</span>
            </div>
            <span className="font-semibold text-[var(--text-primary)]">Seniora</span>
          </div>
          <Link
            href="/login"
            className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Sign In
          </Link>
        </div>
      </header>

      <Hero />
      <FeatureGrid />
      <PricingCards />

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-[var(--border-default)] bg-[var(--bg-primary)]">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[var(--accent)] flex items-center justify-center">
              <span className="text-white font-bold text-[10px]">S</span>
            </div>
            <span className="text-sm text-[var(--text-muted)]">Seniora</span>
          </div>
          <p className="text-sm text-[var(--text-muted)]">&copy; 2026 Seniora. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
```

**Step 5: Commit**

```bash
git add src/components/landing/ src/app/page.tsx
git commit -m "feat: rebuild landing page with hero, features, and pricing"
```

---

## Phase 3: Dashboard

### Task 5: Rebuild dashboard page

**Files:**
- Create: `src/components/dashboard/ProfileCard.tsx`
- Modify: `src/app/dashboard/page.tsx`

**Step 1: Create ProfileCard**

A premium-looking card with avatar, name, last assessment score, and quick actions. Full code included with hover animation, severity badge, and stagger support.

**Step 2: Rebuild dashboard page**

Replace `src/app/dashboard/page.tsx` with the new layout using TopBar, greeting, StaggerContainer for cards, and empty state.

**Step 3: Commit**

```bash
git add src/components/dashboard/ src/app/dashboard/page.tsx
git commit -m "feat: rebuild dashboard with profile cards and sidebar layout"
```

---

## Phase 4: Elderly Profile

### Task 6: Rebuild elderly profile page with tabs

**Files:**
- Create: `src/components/profile/ProfileHeader.tsx`
- Create: `src/components/profile/TabNav.tsx`
- Create: `src/components/profile/StatCard.tsx`
- Modify: `src/app/elderly/[id]/page.tsx`

Rebuild the profile page with a horizontal header card, animated tab navigation (Overview, Medications, Reminders, Assessment, Call Logs), and crossfade transitions between tab content. Reuse existing form/list components (MedicationList, ReminderList, etc.) wrapped in the new layout.

**Step: Commit**

```bash
git add src/components/profile/ src/app/elderly/[id]/page.tsx
git commit -m "feat: rebuild elderly profile page with tabs and animated transitions"
```

---

## Phase 5: Assessment Analytics Dashboard (Dark Theme)

### Task 7: Create assessment trends API endpoint

**Files:**
- Create: `src/app/api/elderly/[id]/assessment/trends/route.ts`

**Step 1: Create the endpoint**

Returns last 30 days of assessment sessions with scores, severity, vocal analysis data aggregated into chart-ready arrays.

```typescript
// Returns: { sessions: [...], trends: { dates[], scores[], wellness[], depression[] } }
```

**Step 2: Commit**

```bash
git add src/app/api/elderly/[id]/assessment/trends/route.ts
git commit -m "feat: add assessment trends API endpoint for 30-day chart data"
```

---

### Task 8: Build assessment chart components

**Files:**
- Create: `src/components/assessment/ScoreGauge.tsx` — nivo RadialBar for cognitive score
- Create: `src/components/assessment/TrendChart.tsx` — nivo Line with multi-axis, gradient fills, 30-day view
- Create: `src/components/assessment/RadarChart.tsx` — nivo Radar for vocal biomarkers
- Create: `src/components/assessment/HeatmapChart.tsx` — nivo HeatMap for daily mood patterns
- Create: `src/components/assessment/RiskCard.tsx` — animated circular progress with trend arrows
- Create: `src/components/assessment/QuestionList.tsx` — expandable Q&A breakdown
- Create: `src/components/assessment/HistoryTimeline.tsx` — horizontal scrollable session selector

Each component uses nivo with custom dark theme colors, animated entrances, and interactive tooltips.

**Step: Commit**

```bash
git add src/components/assessment/
git commit -m "feat: add medical chart components (gauges, trends, radar, heatmap)"
```

---

### Task 9: Rebuild assessment page

**Files:**
- Modify: `src/app/elderly/[id]/assessment/page.tsx`

Rebuild the page with dark theme wrapper (`.theme-dark`), all chart components laid out in the 5-row grid described in the design. Fetches both existing assessment data and new trends endpoint. Setup tab remains light theme.

**Step: Commit**

```bash
git add src/app/elderly/[id]/assessment/page.tsx
git commit -m "feat: rebuild assessment page with dark analytics dashboard"
```

---

## Phase 6: Login & Subscription

### Task 10: Update login page and subscription state

**Files:**
- Modify: `src/app/login/page.tsx`
- Modify: `src/contexts/AuthContext.tsx`

Login page reads `?plan=` query param. After successful auth, stores chosen plan in context/localStorage. Sidebar and dashboard reflect subscription status. Clean minimal login card with smooth animation.

**Step: Commit**

```bash
git add src/app/login/page.tsx src/contexts/AuthContext.tsx
git commit -m "feat: update login with plan selection and subscription state"
```

---

## Phase 7: Polish

### Task 11: Delete old Navbar component and cleanup

**Files:**
- Delete: `src/components/Navbar.tsx`
- Verify: no remaining imports of old Navbar

**Step: Commit**

```bash
git rm src/components/Navbar.tsx
git add -A
git commit -m "chore: remove old Navbar and cleanup unused imports"
```

---

### Task 12: Final responsive polish and push

Verify all pages render correctly on mobile/tablet/desktop. Fix any layout issues. Push all commits.

```bash
git push
```
