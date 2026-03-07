# Seniora AI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an AI-driven elderly care platform where caregivers manage medication reminders that trigger automated voice calls to elderly individuals.

**Architecture:** Single Next.js app (App Router) with API routes and a separate cron worker process. PostgreSQL via Prisma for persistence. Auth0 for auth, Twilio for calls/OTP, Gemini for script generation, ElevenLabs for TTS.

**Tech Stack:** Next.js 14+, TypeScript, Prisma, PostgreSQL, Auth0, Twilio, Google Gemini API, ElevenLabs API, Tailwind CSS

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.js`, `tailwind.config.ts`, `postcss.config.js`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Create: `.env.example`, `.gitignore`

**Step 1: Initialize Next.js project with TypeScript and Tailwind**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

**Step 2: Verify the app starts**

Run: `npm run dev`
Expected: App runs on localhost:3000

**Step 3: Create `.env.example` with all required env vars**

```env
# Auth0
AUTH0_SECRET=
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/seniora

# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
TWILIO_VERIFY_SERVICE_SID=

# Google Gemini
GEMINI_API_KEY=

# ElevenLabs
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Step 4: Update `.gitignore` to include `.env`**

Ensure `.env` and `node_modules` are ignored (create-next-app should handle this, verify).

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: scaffold Next.js project with TypeScript and Tailwind"
```

---

### Task 2: Prisma Setup & Database Schema

**Files:**
- Create: `prisma/schema.prisma`
- Modify: `package.json` (add prisma scripts)

**Step 1: Install Prisma**

```bash
npm install prisma --save-dev && npm install @prisma/client
npx prisma init
```

**Step 2: Define the schema in `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id              String           @id @default(cuid())
  auth0Id         String           @unique
  email           String           @unique
  name            String?
  createdAt       DateTime         @default(now())
  elderlyProfiles ElderlyProfile[]
}

model ElderlyProfile {
  id            String       @id @default(cuid())
  name          String
  phone         String
  phoneVerified Boolean      @default(false)
  language      String       @default("en")
  managerId     String
  manager       User         @relation(fields: [managerId], references: [id], onDelete: Cascade)
  caregivers    Caregiver[]
  medications   Medication[]
  reminders     Reminder[]
  createdAt     DateTime     @default(now())
}

model Caregiver {
  id               String         @id @default(cuid())
  name             String
  phone            String
  phoneVerified    Boolean        @default(false)
  elderlyProfileId String
  elderlyProfile   ElderlyProfile @relation(fields: [elderlyProfileId], references: [id], onDelete: Cascade)
  createdAt        DateTime       @default(now())
}

model Medication {
  id               String         @id @default(cuid())
  name             String
  dosage           String?
  instructions     String?
  elderlyProfileId String
  elderlyProfile   ElderlyProfile @relation(fields: [elderlyProfileId], references: [id], onDelete: Cascade)
  reminders        Reminder[]
  createdAt        DateTime       @default(now())
}

enum ReminderType {
  MEDICATION
  CUSTOM
}

enum Recurrence {
  DAILY
  SPECIFIC_DAYS
}

model Reminder {
  id               String         @id @default(cuid())
  type             ReminderType
  title            String
  description      String?
  medicationId     String?
  medication       Medication?    @relation(fields: [medicationId], references: [id], onDelete: SetNull)
  elderlyProfileId String
  elderlyProfile   ElderlyProfile @relation(fields: [elderlyProfileId], references: [id], onDelete: Cascade)
  scheduledTime    String         // HH:mm format
  recurrence       Recurrence     @default(DAILY)
  daysOfWeek       Int[]          // 0=Sun..6=Sat, used when recurrence=SPECIFIC_DAYS
  leadTimeMinutes  Int            @default(0)
  active           Boolean        @default(true)
  logs             ReminderLog[]
  createdAt        DateTime       @default(now())
}

enum CallStatus {
  PENDING
  CALLING
  CONFIRMED
  NO_ANSWER
  FAILED
}

model ReminderLog {
  id            String     @id @default(cuid())
  reminderId    String
  reminder      Reminder   @relation(fields: [reminderId], references: [id], onDelete: Cascade)
  status        CallStatus @default(PENDING)
  calledAt      DateTime?
  respondedAt   DateTime?
  audioUrl      String?
  twilioCallSid String?
  createdAt     DateTime   @default(now())
}
```

**Step 3: Create Prisma client singleton**

Create `src/lib/prisma.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

**Step 4: Run initial migration**

```bash
npx prisma migrate dev --name init
```

Expected: Migration created, tables exist in PostgreSQL.

**Step 5: Verify with Prisma Studio**

```bash
npx prisma studio
```

Expected: Opens browser showing all 6 tables.

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: add Prisma schema with all core tables"
```

---

### Task 3: Auth0 Integration

**Files:**
- Create: `src/app/api/auth/[...auth0]/route.ts`
- Create: `src/app/api/auth/me/route.ts`
- Create: `src/lib/auth.ts`
- Modify: `src/app/layout.tsx`

**Step 1: Install Auth0 SDK**

```bash
npm install @auth0/nextjs-auth0
```

**Step 2: Create Auth0 route handler**

Create `src/app/api/auth/[...auth0]/route.ts`:

```typescript
import { handleAuth } from "@auth0/nextjs-auth0";

export const GET = handleAuth();
```

**Step 3: Create auth helper for API routes**

Create `src/lib/auth.ts`:

```typescript
import { getSession } from "@auth0/nextjs-auth0";
import { prisma } from "./prisma";

export async function getCurrentUser() {
  const session = await getSession();
  if (!session?.user) return null;

  const user = await prisma.user.upsert({
    where: { auth0Id: session.user.sub },
    update: { email: session.user.email, name: session.user.name },
    create: {
      auth0Id: session.user.sub,
      email: session.user.email,
      name: session.user.name,
    },
  });

  return user;
}
```

**Step 4: Wrap layout with UserProvider**

Modify `src/app/layout.tsx`:

```typescript
import { UserProvider } from "@auth0/nextjs-auth0/client";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <UserProvider>{children}</UserProvider>
      </body>
    </html>
  );
}
```

**Step 5: Test login flow**

1. Set up Auth0 tenant with Google OAuth + email/password
2. Fill in `.env` with Auth0 credentials
3. Visit `/api/auth/login` → should redirect to Auth0
4. After login, visit `/api/auth/me` → should return user JSON

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: integrate Auth0 authentication"
```

---

### Task 4: Elderly Profile API & Dashboard

**Files:**
- Create: `src/app/api/elderly/route.ts` (GET, POST)
- Create: `src/app/api/elderly/[id]/route.ts` (GET, PUT, DELETE)
- Create: `src/app/dashboard/page.tsx`
- Create: `src/app/elderly/[id]/page.tsx`
- Create: `src/components/ElderlyProfileCard.tsx`
- Create: `src/components/CreateElderlyForm.tsx`

**Step 1: Build the API routes**

`src/app/api/elderly/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profiles = await prisma.elderlyProfile.findMany({
    where: { managerId: user.id },
    include: { caregivers: true, _count: { select: { reminders: true } } },
  });

  return NextResponse.json(profiles);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, phone, language } = await req.json();

  const profile = await prisma.elderlyProfile.create({
    data: { name, phone, language: language || "en", managerId: user.id },
  });

  return NextResponse.json(profile, { status: 201 });
}
```

`src/app/api/elderly/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.elderlyProfile.findFirst({
    where: { id: params.id, managerId: user.id },
    include: { caregivers: true, medications: true, reminders: true },
  });

  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(profile);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = await req.json();
  const profile = await prisma.elderlyProfile.updateMany({
    where: { id: params.id, managerId: user.id },
    data,
  });

  return NextResponse.json(profile);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.elderlyProfile.deleteMany({
    where: { id: params.id, managerId: user.id },
  });

  return NextResponse.json({ success: true });
}
```

**Step 2: Build the dashboard page**

Create `src/app/dashboard/page.tsx` — lists all elderly profiles for the logged-in manager with cards showing name, phone, caregiver count, and reminder count. Includes a button/modal to create a new elderly profile.

**Step 3: Build the elderly detail page**

Create `src/app/elderly/[id]/page.tsx` — shows care circle overview, list of caregivers with verification badges, and links to reminders/logs sub-pages.

**Step 4: Test manually**

1. Log in, go to `/dashboard`
2. Create an elderly profile
3. Verify it appears on the dashboard
4. Click into it, verify detail page loads

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add elderly profile CRUD API and dashboard pages"
```

---

### Task 5: Caregiver Management API & UI

**Files:**
- Create: `src/app/api/elderly/[id]/caregivers/route.ts` (GET, POST)
- Create: `src/app/api/elderly/[id]/caregivers/[caregiverId]/route.ts` (DELETE)
- Create: `src/components/CaregiverList.tsx`
- Create: `src/components/AddCaregiverForm.tsx`

**Step 1: Build caregiver API routes**

GET returns all caregivers for a profile. POST adds a new one (name + phone). DELETE removes one. All routes verify the logged-in user owns the elderly profile.

**Step 2: Build caregiver UI components**

- `CaregiverList.tsx`: renders caregivers with name, phone, verified badge, and delete button
- `AddCaregiverForm.tsx`: form with name + phone fields

**Step 3: Integrate into elderly detail page**

Add caregiver list and add form to `src/app/elderly/[id]/page.tsx`.

**Step 4: Test manually**

Add/remove caregivers, verify they persist.

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add caregiver management API and UI"
```

---

### Task 6: Phone Verification (Twilio Verify)

**Files:**
- Create: `src/app/api/verify/send/route.ts`
- Create: `src/app/api/verify/check/route.ts`
- Create: `src/lib/twilio.ts`
- Create: `src/components/PhoneVerification.tsx`

**Step 1: Install Twilio SDK**

```bash
npm install twilio
```

**Step 2: Create Twilio client singleton**

Create `src/lib/twilio.ts`:

```typescript
import twilio from "twilio";

export const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);
```

**Step 3: Build verification API routes**

`/api/verify/send` — accepts `{ phone }`, calls `twilioClient.verify.v2.services(SID).verifications.create({ to: phone, channel: "sms" })`.

`/api/verify/check` — accepts `{ phone, code }`, calls `twilioClient.verify.v2.services(SID).verificationChecks.create({ to: phone, code })`. On success, updates the corresponding ElderlyProfile or Caregiver record to set `phoneVerified = true`.

**Step 4: Build PhoneVerification component**

A component that shows "Verify" button next to unverified phones, opens an OTP input, and calls the verify/check endpoint.

**Step 5: Integrate into caregiver list and elderly profile detail**

Show verification status and verify button for each phone number.

**Step 6: Test with a real phone number**

Send OTP, enter code, verify badge appears.

**Step 7: Commit**

```bash
git add -A && git commit -m "feat: add phone verification via Twilio Verify OTP"
```

---

### Task 7: Medication API & UI

**Files:**
- Create: `src/app/api/elderly/[id]/medications/route.ts` (GET, POST)
- Create: `src/app/api/elderly/[id]/medications/[medId]/route.ts` (PUT, DELETE)
- Create: `src/app/elderly/[id]/reminders/page.tsx`
- Create: `src/components/MedicationList.tsx`
- Create: `src/components/AddMedicationForm.tsx`

**Step 1: Build medication API routes**

CRUD for medications scoped to an elderly profile. Fields: name, dosage, instructions.

**Step 2: Build medication UI**

- `MedicationList.tsx`: cards showing medication name, dosage, instructions, with edit/delete
- `AddMedicationForm.tsx`: form with name, dosage, instructions fields

**Step 3: Integrate into reminders page**

The `/elderly/[id]/reminders` page shows medications section at top, reminders section below.

**Step 4: Test manually**

Add/edit/delete medications.

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add medication CRUD API and UI"
```

---

### Task 8: Reminder API & UI

**Files:**
- Create: `src/app/api/elderly/[id]/reminders/route.ts` (GET, POST)
- Create: `src/app/api/elderly/[id]/reminders/[reminderId]/route.ts` (PUT, DELETE)
- Create: `src/components/ReminderList.tsx`
- Create: `src/components/AddReminderForm.tsx`

**Step 1: Build reminder API routes**

CRUD for reminders. POST accepts: type (MEDICATION or CUSTOM), title, description, medicationId (if type=MEDICATION), scheduledTime (HH:mm), recurrence, daysOfWeek, leadTimeMinutes.

**Step 2: Build reminder UI**

- `ReminderList.tsx`: shows reminders grouped by time, with active/inactive toggle, edit, delete
- `AddReminderForm.tsx`: form with type selector (links to medication dropdown or free text), time picker, recurrence selector, lead time input

**Step 3: Integrate into reminders page**

Add below the medications section on `/elderly/[id]/reminders`.

**Step 4: Test manually**

Create medication reminder, create custom reminder, toggle active, delete.

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add reminder CRUD API and UI"
```

---

### Task 9: Voice Call Pipeline — Gemini + ElevenLabs + Twilio

**Files:**
- Create: `src/lib/gemini.ts`
- Create: `src/lib/elevenlabs.ts`
- Create: `src/lib/voice-call.ts`
- Create: `src/app/api/webhooks/twilio/route.ts`

**Step 1: Install dependencies**

```bash
npm install @google/generative-ai
```

**Step 2: Create Gemini script generator**

Create `src/lib/gemini.ts`:

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function generateReminderScript(context: {
  elderlyName: string;
  medication?: { name: string; dosage?: string; instructions?: string };
  customTask?: string;
  language: string;
  timeOfDay: string;
}): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `You are a caring, warm assistant calling an elderly person named ${context.elderlyName}.
Generate a short, clear, empathetic phone reminder in ${context.language === "ar" ? "Arabic" : "English"}.
Time of day: ${context.timeOfDay}.
${context.medication ? `Medication: ${context.medication.name}, Dosage: ${context.medication.dosage || "as prescribed"}. Instructions: ${context.medication.instructions || "none"}.` : ""}
${context.customTask ? `Task: ${context.customTask}` : ""}
Keep it under 4 sentences. Be warm but concise. State their name and the specific action.`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}
```

**Step 3: Create ElevenLabs TTS client**

Create `src/lib/elevenlabs.ts`:

```typescript
export async function textToSpeech(text: string): Promise<Buffer> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID!}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.75, similarity_boost: 0.75 },
      }),
    }
  );

  if (!response.ok) throw new Error(`ElevenLabs error: ${response.statusText}`);
  return Buffer.from(await response.arrayBuffer());
}
```

**Step 4: Create voice call orchestrator**

Create `src/lib/voice-call.ts`:

```typescript
import { prisma } from "./prisma";
import { twilioClient } from "./twilio";
import { generateReminderScript } from "./gemini";
import { textToSpeech } from "./elevenlabs";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function executeReminderCall(reminderId: string) {
  const reminder = await prisma.reminder.findUnique({
    where: { id: reminderId },
    include: { elderlyProfile: true, medication: true },
  });

  if (!reminder || !reminder.elderlyProfile.phoneVerified) return;

  // Create log entry
  const log = await prisma.reminderLog.create({
    data: { reminderId, status: "CALLING", calledAt: new Date() },
  });

  try {
    // 1. Generate script
    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

    const script = await generateReminderScript({
      elderlyName: reminder.elderlyProfile.name,
      medication: reminder.medication
        ? { name: reminder.medication.name, dosage: reminder.medication.dosage || undefined, instructions: reminder.medication.instructions || undefined }
        : undefined,
      customTask: reminder.type === "CUSTOM" ? reminder.title : undefined,
      language: reminder.elderlyProfile.language,
      timeOfDay,
    });

    // 2. Generate audio
    const audioBuffer = await textToSpeech(script);

    // 3. Save audio file
    const audioDir = path.join(process.cwd(), "public", "audio");
    await mkdir(audioDir, { recursive: true });
    const audioFileName = `reminder-${log.id}.mp3`;
    const audioPath = path.join(audioDir, audioFileName);
    await writeFile(audioPath, audioBuffer);

    const audioUrl = `${process.env.NEXT_PUBLIC_APP_URL}/audio/${audioFileName}`;

    // 4. Make Twilio call
    const call = await twilioClient.calls.create({
      to: reminder.elderlyProfile.phone,
      from: process.env.TWILIO_PHONE_NUMBER!,
      twiml: `<Response>
        <Play>${audioUrl}</Play>
        <Gather numDigits="1" action="${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio?logId=${log.id}" method="POST" timeout="10">
          <Say>Press 1 to confirm you heard this reminder. Press 2 to hear it again.</Say>
        </Gather>
        <Say>No response received. Goodbye.</Say>
      </Response>`,
    });

    // 5. Update log
    await prisma.reminderLog.update({
      where: { id: log.id },
      data: { audioUrl, twilioCallSid: call.sid },
    });
  } catch (error) {
    await prisma.reminderLog.update({
      where: { id: log.id },
      data: { status: "FAILED" },
    });
    console.error("Voice call failed:", error);
  }
}
```

**Step 5: Create Twilio webhook handler**

Create `src/app/api/webhooks/twilio/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const digits = formData.get("Digits") as string;
  const logId = req.nextUrl.searchParams.get("logId");

  if (!logId) return new NextResponse("<Response><Say>Error.</Say></Response>", {
    headers: { "Content-Type": "text/xml" },
  });

  if (digits === "1") {
    await prisma.reminderLog.update({
      where: { id: logId },
      data: { status: "CONFIRMED", respondedAt: new Date() },
    });
    return new NextResponse(
      "<Response><Say>Thank you! Your confirmation has been recorded. Take care!</Say></Response>",
      { headers: { "Content-Type": "text/xml" } }
    );
  }

  if (digits === "2") {
    const log = await prisma.reminderLog.findUnique({ where: { id: logId } });
    return new NextResponse(
      `<Response>
        <Play>${log?.audioUrl}</Play>
        <Gather numDigits="1" action="${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio?logId=${logId}" method="POST" timeout="10">
          <Say>Press 1 to confirm. Press 2 to hear again.</Say>
        </Gather>
      </Response>`,
      { headers: { "Content-Type": "text/xml" } }
    );
  }

  return new NextResponse("<Response><Say>Goodbye.</Say></Response>", {
    headers: { "Content-Type": "text/xml" },
  });
}
```

**Step 6: Test the pipeline manually**

Create a test script or API route that triggers `executeReminderCall` for a specific reminder. Verify: Gemini generates script → ElevenLabs produces audio → Twilio places call → keypress works.

**Step 7: Commit**

```bash
git add -A && git commit -m "feat: implement voice call pipeline with Gemini, ElevenLabs, and Twilio"
```

---

### Task 10: Cron Worker

**Files:**
- Create: `src/cron/worker.ts`
- Modify: `package.json` (add cron script)

**Step 1: Install cron library**

```bash
npm install node-cron
npm install --save-dev tsx @types/node-cron
```

**Step 2: Create the cron worker**

Create `src/cron/worker.ts`:

```typescript
import cron from "node-cron";
import { PrismaClient } from "@prisma/client";
import { executeReminderCall } from "../lib/voice-call";

const prisma = new PrismaClient();

function getTimeWindow() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function getDayOfWeek() {
  return new Date().getDay(); // 0=Sun..6=Sat
}

async function processReminders() {
  const currentTime = getTimeWindow();
  const currentDay = getDayOfWeek();

  // Find active reminders that match the current time (adjusted for lead time)
  const reminders = await prisma.reminder.findMany({
    where: {
      active: true,
      elderlyProfile: { phoneVerified: true },
    },
    include: { elderlyProfile: true },
  });

  for (const reminder of reminders) {
    // Calculate effective trigger time
    const [h, m] = reminder.scheduledTime.split(":").map(Number);
    const scheduledMinutes = h * 60 + m;
    const effectiveMinutes = scheduledMinutes - reminder.leadTimeMinutes;
    const effectiveH = String(Math.floor(((effectiveMinutes % 1440) + 1440) % 1440 / 60)).padStart(2, "0");
    const effectiveM = String(((effectiveMinutes % 60) + 60) % 60).padStart(2, "0");
    const effectiveTime = `${effectiveH}:${effectiveM}`;

    if (effectiveTime !== currentTime) continue;

    // Check recurrence
    if (reminder.recurrence === "SPECIFIC_DAYS" && !reminder.daysOfWeek.includes(currentDay)) continue;

    // Check if already called today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const existingLog = await prisma.reminderLog.findFirst({
      where: {
        reminderId: reminder.id,
        createdAt: { gte: today },
      },
    });

    if (existingLog) continue;

    console.log(`Triggering reminder: ${reminder.title} for ${reminder.elderlyProfile.name}`);
    await executeReminderCall(reminder.id);
  }
}

// Run every minute
cron.schedule("* * * * *", async () => {
  console.log(`[${new Date().toISOString()}] Checking reminders...`);
  try {
    await processReminders();
  } catch (error) {
    console.error("Error processing reminders:", error);
  }
});

console.log("Cron worker started. Checking reminders every minute.");
```

**Step 3: Add script to package.json**

```json
{
  "scripts": {
    "cron": "tsx src/cron/worker.ts"
  }
}
```

**Step 4: Test the cron worker**

1. Create a reminder with scheduledTime set to 1 minute from now
2. Run `npm run cron`
3. Verify it picks up the reminder and triggers the call pipeline

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add cron worker for reminder scheduling"
```

---

### Task 11: Reminder Logs API & UI

**Files:**
- Create: `src/app/api/elderly/[id]/logs/route.ts`
- Create: `src/app/elderly/[id]/logs/page.tsx`
- Create: `src/components/ReminderLogList.tsx`

**Step 1: Build logs API route**

GET returns reminder logs for an elderly profile, ordered by createdAt desc, with reminder title included.

**Step 2: Build logs page**

`/elderly/[id]/logs` — table showing: date/time, reminder title, status (with color-coded badge: green=confirmed, yellow=calling, red=failed/no_answer), call SID.

**Step 3: Test manually**

After triggering a call (Task 10), verify the log appears on the logs page with correct status.

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add reminder logs page"
```

---

### Task 12: Landing Page & Navigation

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/components/Navbar.tsx`
- Create: `src/components/Sidebar.tsx`

**Step 1: Build landing page**

`src/app/page.tsx` — simple landing with app description and login button. Redirects to `/dashboard` if already authenticated.

**Step 2: Build navigation**

- `Navbar.tsx`: app logo, user name, logout button
- `Sidebar.tsx`: navigation links for elderly profiles, used in dashboard layout

**Step 3: Create dashboard layout**

Create `src/app/dashboard/layout.tsx` — wraps dashboard and elderly sub-pages with navbar + sidebar.

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add landing page and navigation layout"
```

---

### Task 13: Deployment Setup (Vultr VPS)

**Files:**
- Create: `ecosystem.config.js` (PM2 config)
- Create: `scripts/deploy.sh`

**Step 1: Install PM2 for process management**

```bash
npm install --save-dev pm2
```

**Step 2: Create PM2 config**

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: "seniora-web",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
    {
      name: "seniora-cron",
      script: "npx",
      args: "tsx src/cron/worker.ts",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
```

**Step 3: Create deploy script**

Create `scripts/deploy.sh`:

```bash
#!/bin/bash
set -e

echo "Pulling latest code..."
git pull origin main

echo "Installing dependencies..."
npm ci

echo "Running migrations..."
npx prisma migrate deploy

echo "Building..."
npm run build

echo "Restarting services..."
pm2 restart ecosystem.config.js

echo "Deployment complete!"
```

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add PM2 config and deploy script for Vultr"
```

---

## Execution Order Summary

| Task | Description | Depends On |
|------|-------------|------------|
| 1 | Project scaffolding | — |
| 2 | Prisma schema & DB | 1 |
| 3 | Auth0 integration | 1 |
| 4 | Elderly profile API & dashboard | 2, 3 |
| 5 | Caregiver management | 4 |
| 6 | Phone verification (Twilio) | 5 |
| 7 | Medication API & UI | 4 |
| 8 | Reminder API & UI | 7 |
| 9 | Voice call pipeline | 2, 6 |
| 10 | Cron worker | 9, 8 |
| 11 | Reminder logs | 10 |
| 12 | Landing page & navigation | 4 |
| 13 | Deployment setup | All |
