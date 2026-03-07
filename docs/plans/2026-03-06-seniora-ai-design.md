# Seniora AI — System Design

## Overview

AI-driven elderly care platform that helps manage medications and daily tasks through automated, interactive voice calls. Caregivers set up reminders via a web dashboard; the system generates empathetic AI voice calls to remind elderly individuals at scheduled times.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend & API | Next.js (App Router) |
| Database | PostgreSQL + Prisma ORM |
| Authentication | Auth0 (Google OAuth + Email/Password) |
| Telephony | Twilio (outbound calls + Verify for OTP) |
| AI Script Generation | Google Gemini API |
| Voice Synthesis | ElevenLabs TTS API |
| Deployment | Vultr VPS |

## Architecture

Single Next.js application with a separate cron worker process, both running on Vultr.

```
Caregiver → Dashboard UI → API Routes → PostgreSQL
                                            ↓
Cron Worker polls DB every 60s for due reminders
                                            ↓
Gemini API → generates empathetic reminder script
                                            ↓
ElevenLabs → converts script to audio (MP3)
                                            ↓
Twilio → outbound call, plays audio
                                            ↓
Elderly responds (keypress) → Twilio webhook → API logs result
                                            ↓
Caregivers see call status on dashboard
```

## Authentication

- Auth0 via `nextjs-auth0` SDK
- Google OAuth + email/password
- On first login, User record created in DB linked to Auth0 `sub`
- All API routes protected with Auth0 session middleware
- Every user starts as a Manager (creates care circles)

## Database Schema (Core Tables)

### User
- id, auth0Id, email, name, createdAt

### ElderlyProfile
- id, name, phone, phoneVerified, language, managerId (FK → User), createdAt

### Caregiver
- id, name, phone, phoneVerified, elderlyProfileId (FK → ElderlyProfile), createdAt

### Medication
- id, name, dosage, instructions, elderlyProfileId (FK → ElderlyProfile), createdAt

### Reminder
- id, type (medication | custom), title, description
- medicationId (FK → Medication, nullable)
- elderlyProfileId (FK → ElderlyProfile)
- scheduledTime, recurrence (daily | specific days), leadTimeMinutes
- active (boolean), createdAt

### ReminderLog
- id, reminderId (FK → Reminder)
- status (pending | calling | confirmed | no_answer | failed)
- calledAt, respondedAt, audioUrl, twilioCallSid

## Care Circle Flow

1. Manager creates an Elderly Profile (name + phone)
2. Phone verified via Twilio Verify (OTP)
3. Manager adds Caregivers (name + phone, each OTP-verified)
4. Caregivers linked to the elderly profile
5. Dashboard shows care circle with verification badges

## Reminder Management

- Caregivers and manager access dashboard for a specific elderly profile
- Add Medication: name, dosage, instructions, schedule (time + recurrence), lead time
- Add Custom Reminder: free-text task, schedule, lead time
- Effective trigger time = scheduledTime - leadTimeMinutes
- Edit/delete/pause reminders from dashboard

## Voice Call Pipeline

Every 60 seconds, the cron worker:

1. **Query**: Find reminders where effective trigger time is within the current minute and status is pending
2. **Generate Script**: Gemini API with context (name, medication, dosage, time of day, language)
3. **Synthesize Voice**: ElevenLabs TTS → MP3 audio
4. **Store Audio**: Save to Vultr Object Storage or local storage → public URL
5. **Initiate Call**: Twilio outbound call with TwiML playing the audio URL
6. **Handle Response**: After message plays, prompt "Press 1 to confirm, Press 2 to repeat"
7. **Log Result**: Twilio webhook updates ReminderLog with call outcome

## Pages

| Route | Purpose |
|-------|---------|
| `/` | Landing / login |
| `/dashboard` | List elderly profiles managed by user |
| `/elderly/[id]` | Care circle overview, caregiver management |
| `/elderly/[id]/reminders` | Medication & reminder CRUD |
| `/elderly/[id]/logs` | Call history with status |

## API Routes

```
/api/auth/[...auth0]            — Auth0 handlers
/api/elderly                    — CRUD elderly profiles
/api/elderly/[id]/caregivers    — CRUD caregivers
/api/elderly/[id]/medications   — CRUD medications
/api/elderly/[id]/reminders     — CRUD reminders
/api/elderly/[id]/logs          — Read reminder logs
/api/verify/send                — Send OTP
/api/verify/check               — Verify OTP
/api/webhooks/twilio            — Twilio call status & keypress callbacks
```

## Key Design Decisions

- **Monolith over microservices**: Single Next.js app + cron worker keeps deployment simple on a VPS
- **Cron polling over message queue**: No Redis dependency; 60s polling granularity is sufficient for medication reminders
- **Twilio for both calls and OTP**: Single telephony provider reduces integration complexity
- **Audio pre-generation**: Generate and store audio before initiating call to avoid latency during the call
- **Interactive calls**: Keypress confirmation gives caregivers confidence the reminder was received
