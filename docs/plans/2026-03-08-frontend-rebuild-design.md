# Frontend Rebuild Design — Seniora AI

## Goal

Rebuild the entire frontend of the Seniora elderly care platform with a premium, market-ready UI/UX. Ultra-minimalist design, sophisticated medical data visualizations, smooth animations, and a clear Free/Premium pricing model.

## Design Principles

- Ultra-minimalist, modern, professional
- Market-ready — looks like a real commercial product
- Light theme for public pages and general UI
- Dark theme for medical analytics dashboard
- Purposeful animations — staggered fades, micro-interactions, smooth transitions
- Mobile-first responsive design
- All English copy

---

## Pages & Layouts

### 1. Landing Page (`/`)

- Full-screen hero: bold headline, subtitle, two CTA buttons (Free / Premium $10/mo)
- Clean white background, abstract medical graphic
- Staggered text fade-in on load (Framer Motion)
- Pricing section: two cards (Free vs Premium $10/mo with "Recommended" badge)
  - Both link to `/login?plan=free` or `/login?plan=premium`
  - Subtle hover lift animation
- Features section: 3-4 blocks (AI Voice Calls, Smart Reminders, Cognitive Assessment, Caregiver Network)
  - Staggered fade-in on scroll
- Minimal footer: logo + copyright
- No navbar — small logo top-left, "Sign In" top-right

### 2. Login Page (`/login`)

- Reads `?plan=` query param, stores chosen plan
- Firebase auth (Google OAuth + Email/Password)
- Clean centered card layout
- Smooth fade-in on mount

### 3. Dashboard (`/dashboard`)

- Collapsible sidebar navigation: Dashboard, Settings, Subscription, Sign Out
- Subscription badge in sidebar: "Premium — Active" (green) or "Free Plan" (gray)
- Greeting: "Good morning, [Name]"
- Profile cards in responsive grid (2-3 columns)
  - Avatar, name, last assessment score badge, next call time, quick actions
  - Staggered entrance animation
- Empty state with illustration + CTA
- Top bar: search/filter + notification bell (future-ready)

### 4. Elderly Profile Detail (`/elderly/[id]`)

- Profile header card (avatar, name, phone, language)
- Tab navigation: Overview, Medications, Reminders, Assessment, Call Logs
- Crossfade transition between tabs

**Overview Tab:**
- Quick stats row: total medications, active reminders, last score, days since last call
- Emergency contact card, caregiver chips, voice settings

**Medications Tab:**
- Clean list with pill icons, dosage, schedule
- Inline add/edit with expand animation
- Active/inactive toggle with micro-interaction

**Reminders Tab:**
- List with toggle switches
- Small timeline showing today's reminders

**Call Logs Tab:**
- Table with color-coded status badges
- Expandable rows with audio playback

### 5. Assessment Analytics Dashboard (`/elderly/[id]` — Assessment Tab)

**Dark theme** — background transitions to dark when entering this tab.

**Top Row — Score Overview:**
- Large radial gauge (nivo): latest cognitive score 0-100%, severity color ring
- Two smaller radial gauges: Wellness Score, Mood indicator
- Animated fill on load

**Second Row — 30-Day Trend Analysis:**
- Multi-axis area chart: daily cognitive score, wellness score, depression index over 30 days
- Gradient fills, interactive hover tooltips
- Trend indicator badge: "Improving" / "Declining" / "Stable" derived from slope

**Third Row — Vocal Biomarker Panels:**
- Radar chart: all vocal metrics on spider web (Parkinson's, depression, wellness, mood, speech fluency)
- Heatmap: daily mood patterns over month (rows=weeks, cols=days, color=wellness)

**Fourth Row — Risk Assessment Cards:**
- Parkinson's Risk + Depression Risk
- Animated circular progress, future risk %, trend arrow, clinical notes
- Pulse animation on high-risk (red zone)

**Fifth Row — Question Breakdown:**
- Expandable question list from latest session
- Question, elder's answer, correct answer, result badge, audio playback

**Bottom — History Timeline:**
- Horizontal scrollable timeline of past sessions
- Click node to load that session's data into all charts (smooth data transition)

---

## Technical Architecture

### New Dependencies
- `@nivo/core`, `@nivo/radar`, `@nivo/line`, `@nivo/heatmap`, `@nivo/radial-bar` — medical charts
- `framer-motion` — page/layout transitions, staggered reveals
- No UI component library — all custom Tailwind

### Component Structure
```
src/components/
  layout/          Sidebar, TopBar, PageTransition
  landing/         Hero, PricingCards, FeatureGrid
  dashboard/       ProfileCard, SubscriptionBadge
  profile/         ProfileHeader, TabNav, StatCard
  assessment/      ScoreGauge, TrendChart, RadarChart,
                   HeatmapChart, RiskCard, QuestionList,
                   HistoryTimeline
  ui/              Button, Badge, Card, Toggle, AnimatedNumber
```

### Animation Strategy
- Framer Motion: page transitions, staggered list reveals, layout animations, tab crossfades
- CSS/Tailwind: button hovers, toggle micro-interactions, badge pulses, focus states

### Dark Theme for Assessment
- CSS variables scoped to `.theme-dark` class
- Assessment wraps in `<div className="theme-dark">`
- Smooth `transition: background-color 0.3s`

### New API Endpoint
- `GET /api/elderly/[id]/assessment/trends` — returns last 30 days of session data for trend charts

### Subscription State
- Login reads `?plan=` query param
- Stored in user context (cosmetic for now)
- Dashboard sidebar shows Active/Inactive badge
- Premium features display "Active", Free shows "Upgrade" link

### Data Flow for Charts
- Assessment page fetches sessions array (already exists)
- New trends endpoint aggregates 30 days of: scores, vocal analysis, severity
- Frontend transforms into nivo-compatible data structures
- Charts animate on data load with nivo's built-in motion
