# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Seniora-AI — AI-driven elderly care & medication reminder platform. Caregivers manage medications and schedules via a web dashboard; the system makes automated, interactive AI voice calls to remind elderly individuals.

## Tech Stack

- **Framework**: Next.js (App Router)
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: Auth0 (Google OAuth + Email/Password) via `nextjs-auth0`
- **Telephony**: Twilio (outbound calls + Verify for OTP)
- **AI**: Google Gemini API (script generation), ElevenLabs (TTS)
- **Deployment**: Vultr VPS

## Architecture

Single Next.js app + separate cron worker process. The cron worker polls the DB every 60s for due reminders, then orchestrates: Gemini → ElevenLabs → Twilio call pipeline.

## Design Doc

Full system design is at `docs/plans/2026-03-06-seniora-ai-design.md`.
