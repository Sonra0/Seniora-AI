<p align="center">
  <img src="public/logo.png" alt="Seniora Logo" width="180" />
</p>

<h1 align="center">Seniora.life</h1>
<h3 align="center">Compassionate Care & Support — Powered by AI</h3>

<p align="center">
  <b>Hack Canada 2026</b> &middot; Built in 36 hours (+ 30-day build period) at Waterloo's SPUR Innovation Centre
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Google-Gemini%20API-4285F4?style=for-the-badge&logo=google&logoColor=white" />
  <img src="https://img.shields.io/badge/Google-Antigravity-34A853?style=for-the-badge&logo=google&logoColor=white" />
  <img src="https://img.shields.io/badge/Google-Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" />
  <img src="https://img.shields.io/badge/Google-Cloud-4285F4?style=for-the-badge&logo=googlecloud&logoColor=white" />
  <img src="https://img.shields.io/badge/Gemini-CLI-8E75B2?style=for-the-badge&logo=google&logoColor=white" />
  <img src="https://img.shields.io/badge/ElevenLabs-Voice%20AI-000000?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Vultr-Cloud%20VPS-007BFC?style=for-the-badge&logo=vultr&logoColor=white" />
</p>

---

## The Problem

**6.5 million Canadians** are family caregivers. Many live far from the elderly relatives they care for, and the constant worry about whether they took their medication, how they're feeling, or whether their cognitive health is declining is exhausting.

Existing solutions are either too clinical (and ignored), too expensive, or require the elderly person to use apps and devices they can't navigate.

**What if care could just... call?**

---

## What Seniora Does

Seniora is an AI-powered elderly care platform that makes **automated, natural-sounding phone calls** to elderly individuals — no app downloads, no smart devices, no learning curve. Just a phone that rings.

### Daily Medication Reminders
Seniora calls your loved one at the scheduled time with a warm, conversational reminder about each medication — dosage, instructions, and all. If they don't pick up, it retries intelligently.

### Cognitive Assessments
Daily voice-based cognitive check-ins with personalized questions (people recognition, orientation, personal memory, general knowledge). The AI evaluates answers in real-time, scores the session, and tracks trends over 30 days with beautiful analytics dashboards.

### Emotional Check-ins
After cognitive questions, Seniora asks how the person is feeling. If the AI detects distress, it immediately alerts caregivers via Telegram and offers to connect the elder with their emergency contact — right from the call.

### Vocal Analysis
Every call is analyzed for vocal biomarkers that may indicate early signs of depression, Parkinson's, or changes in overall wellness. Results appear in the caregiver dashboard as radar charts and trend graphs.

### Caregiver Network
Multiple caregivers can monitor the same person. Instant Telegram notifications with detailed assessment reports, emergency alerts, and call summaries keep everyone in the loop.

---

## Built Heavily with Google & ElevenLabs

This project is **deeply integrated with the Google ecosystem and ElevenLabs** voice technology. They aren't just tools we used — they're the backbone of the entire platform.

### Google Ecosystem

| Product | How We Use It |
|---------|--------------|
| **Gemini API** (gemini-2.5-flash) | The brain of every phone call. Generates personalized greeting scripts, evaluates cognitive assessment answers in real-time, scores emotional responses (positive/negative sentiment), produces warm answer reviews, and creates AI summaries of each session. Every single AI interaction is powered by Gemini. |
| **Google Antigravity** | Our primary development environment. The entire codebase — frontend, backend, API routes, database schema, call flow logic — was built inside Antigravity with its agentic AI assistance, tab autocompletion, and context-aware coding. |
| **Gemini CLI** | Used throughout development for rapid prototyping, debugging complex Twilio webhook flows, and generating boilerplate code for new features. |
| **Firebase Auth** | All user authentication — Google OAuth sign-in, email/password registration, session management, and ID token verification for API routes. |
| **Google Cloud** | Infrastructure foundation. Database hosting, environment management, and the deployment pipeline that keeps everything running. |

### ElevenLabs

| Feature | How We Use It |
|---------|--------------|
| **Text-to-Speech** | Every phone call uses ElevenLabs to generate natural, human-sounding audio. Greetings, questions, emotional responses, answer reviews — all synthesized in real-time with ElevenLabs voices so the calls feel like talking to a real person, not a robot. |
| **Voice Cloning** | Caregivers can clone a familiar voice (like a family member) so the elderly person hears someone they recognize on the phone. This dramatically increases engagement and trust. |
| **Multi-language Support** | Calls are generated in the elder's preferred language (English, Arabic, and more) with natural pronunciation and cadence. |
| **Non-fatal TTS Pipeline** | We built a resilient audio pipeline where every ElevenLabs call is wrapped in try/catch — if the API is rate-limited or down, the system gracefully falls back to Twilio's built-in `<Say>` tags so calls **always** go through. |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router), React 19, TypeScript |
| **Styling** | Tailwind CSS 4, Framer Motion (page transitions, stagger animations) |
| **Charts** | nivo (D3-based) — RadialBar, Line, Radar, HeatMap for medical analytics |
| **Database** | PostgreSQL + Prisma ORM 7 |
| **Auth** | Firebase Auth (Google OAuth + Email/Password) |
| **AI** | Google Gemini API (gemini-2.5-flash) |
| **Voice** | ElevenLabs TTS + Voice Cloning |
| **Telephony** | Twilio (outbound calls, speech recognition, call recording) |
| **Notifications** | Telegram Bot API (caregiver alerts + assessment reports) |
| **Deployment** | Vultr VPS, PM2 process manager, auto-deploy via GitHub |
| **Dev Tools** | Google Antigravity, Gemini CLI, Claude Code |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js App Router                     │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────────┐ │
│  │ Landing   │  │Dashboard │  │ Assessment Analytics   │ │
│  │ Page      │  │ + Sidebar│  │ (Dark Theme + Charts)  │ │
│  └──────────┘  └──────────┘  └────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│                     API Routes                           │
│  /api/elderly  /api/webhooks/assessment  /api/recording  │
├─────────────────────────────────────────────────────────┤
│                    Services Layer                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ Gemini   │  │ElevenLabs│  │  Twilio   │  │Telegram │ │
│  │ AI       │  │ TTS      │  │  Calls    │  │  Bot    │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
├─────────────────────────────────────────────────────────┤
│  PostgreSQL + Prisma  │  Firebase Auth  │  Cron Worker   │
└─────────────────────────────────────────────────────────┘
```

### Call Flow (Assessment)

```
Cron triggers call → Twilio dials elder
  → ElevenLabs generates warm greeting audio
  → Gemini generates personalized questions
  → Elder answers via speech recognition
  → Gemini evaluates each answer in real-time
  → Emotional check-in question
  → Gemini analyzes sentiment
    → If NEGATIVE: Telegram alert + offer emergency call
    → If POSITIVE: warm encouragement
  → Gemini generates answer review summary
  → ElevenLabs synthesizes review audio
  → Session completes → Telegram report to all caregivers
```

---

## Features at a Glance

- **AI Voice Calls** — Natural conversations powered by ElevenLabs + Gemini
- **Smart Medication Reminders** — Scheduled calls with intelligent retry logic
- **Cognitive Assessment** — Daily voice-based check-ins with 30-day trend tracking
- **Emotional Detection** — Real-time sentiment analysis with emergency escalation
- **Medical Analytics Dashboard** — Dark-themed with score gauges, trend lines, radar charts, heatmaps
- **Voice Cloning** — Familiar voices for better engagement
- **Caregiver Network** — Multi-caregiver support with Telegram notifications
- **Subscription Tiers** — Free (1 profile, 2 reminders) and Premium ($10/mo, unlimited)
- **Responsive Design** — Desktop sidebar + mobile bottom navigation
- **Animated UI** — Framer Motion page transitions, stagger effects, tab crossfades

---

## Sponsor Categories

- **Google - Build with AI Track** — Fully built with Google AI tools (Gemini API, Firebase, Google Cloud, Antigravity, Gemini CLI). Solves a real problem for Canadian elderly care.
- **[MLH] Best Use of Gemini API** — Gemini powers every AI interaction: greeting generation, answer evaluation, emotional analysis, session summaries.
- **[MLH] Best Hack Built with Google Antigravity** — Entire codebase developed in Antigravity.
- **MLH x ElevenLabs - Best Project Built with ElevenLabs** — Every call uses ElevenLabs TTS + voice cloning for natural, human-sounding conversations.
- **[MLH] Best Use of Vultr** — Deployed on Vultr Cloud VPS with PM2 process management.
- **Vivirion Solutions - Best Practical Healthcare Hack** — Directly improves elderly healthcare through AI-powered cognitive monitoring and caregiver support.
- **SPUR Founder Track** — Real Canadian healthcare problem with startup potential (seniora.life).
- **Most Technically Complex AI Hack** — Multi-model agentic architecture: Gemini for intelligence, ElevenLabs for voice, Twilio for telephony, real-time vocal biomarker analysis.

---

## Tools, Libraries & Services

**Core:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, PostgreSQL, Prisma 7

**AI & Voice:** Google Gemini API (gemini-2.5-flash), ElevenLabs TTS & Voice Cloning

**Google Products:** Firebase Auth, Google Cloud, Google Antigravity (IDE), Gemini CLI

**Frontend:** Framer Motion, nivo (D3-based charts: RadialBar, Line, Radar, HeatMap)

**Telephony:** Twilio (Voice, Speech Recognition, Call Recording, Verify OTP)

**Notifications:** Telegram Bot API

**Infrastructure:** Vultr Cloud VPS, PM2, GitHub (auto-deploy)

**Dev Tools:** Google Antigravity, Gemini CLI, Claude Code

---

## Running Locally

```bash
# Clone
git clone https://github.com/Sonra0/Seniora-AI.git
cd Seniora-AI

# Install
npm install
npx prisma generate

# Set up environment
cp .env.example .env
# Fill in: DATABASE_URL, Firebase config, Twilio, ElevenLabs, Gemini, Telegram

# Database
npx prisma migrate dev

# Run
npm run dev          # Web app on :3000
npm run cron         # Background worker for scheduled calls
```

---

## The Team

Built with love at **Hack Canada 2026** by the Seniora team.

Because the people who raised us deserve more than a reminder app — they deserve a voice that cares.

---

<p align="center">
  <img src="public/logo.png" alt="Seniora" width="80" />
  <br />
  <b>seniora.life</b> — Care that calls. Literally.
</p>
