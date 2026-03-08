# Alzheimer's Cognitive Assessment — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add daily automated cognitive assessment phone calls with personalized questions, real-time conversational feel, caregiver questionnaire, and reporting with trend tracking.

**Architecture:** Extends the existing cron worker + Twilio webhook pattern. Caregiver fills out questions via a new assessment page. Cron triggers daily calls. Each question uses a Record→Transcribe→Evaluate→Respond webhook chain with filler audio for natural pacing. Gemini evaluates answers and generates reports.

**Tech Stack:** Prisma, Next.js API routes, Twilio (Record + webhooks), Gemini (evaluation + reports), ElevenLabs (TTS), React (assessment UI)

---

### Task 1: Database Schema — Assessment Models

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260307220000_add_assessment_models/migration.sql`

**Step 1: Add enums and models to Prisma schema**

Add after the existing `CallStatus` enum in `prisma/schema.prisma`:

```prisma
enum AssessmentCategory {
  PERSONAL
  ORIENTATION
  PEOPLE
  GENERAL
}

enum AssessmentStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  FAILED
}

enum AssessmentSeverity {
  GREEN
  YELLOW
  RED
}

enum AnswerResult {
  CORRECT
  WRONG
  UNCLEAR
}

model AssessmentQuestion {
  id               String             @id @default(cuid())
  elderlyProfileId String
  elderlyProfile   ElderlyProfile     @relation(fields: [elderlyProfileId], references: [id], onDelete: Cascade)
  category         AssessmentCategory
  questionText     String
  correctAnswer    String
  answers          AssessmentAnswer[]
  createdAt        DateTime           @default(now())
}

model AssessmentConfig {
  id               String         @id @default(cuid())
  elderlyProfileId String         @unique
  elderlyProfile   ElderlyProfile @relation(fields: [elderlyProfileId], references: [id], onDelete: Cascade)
  scheduledTime    String
  questionsPerCall Int            @default(4)
  active           Boolean        @default(false)
  sessions         AssessmentSession[]
  createdAt        DateTime       @default(now())
}

model AssessmentSession {
  id               String             @id @default(cuid())
  elderlyProfileId String
  elderlyProfile   ElderlyProfile     @relation(fields: [elderlyProfileId], references: [id], onDelete: Cascade)
  configId         String
  config           AssessmentConfig   @relation(fields: [configId], references: [id], onDelete: Cascade)
  date             String
  overallScore     Float?
  status           AssessmentStatus   @default(PENDING)
  summary          String?
  severity         AssessmentSeverity?
  answers          AssessmentAnswer[]
  twilioCallSid    String?
  createdAt        DateTime           @default(now())
}

model AssessmentAnswer {
  id            String           @id @default(cuid())
  sessionId     String
  session       AssessmentSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  questionId    String
  question      AssessmentQuestion @relation(fields: [questionId], references: [id], onDelete: Cascade)
  questionText  String
  correctAnswer String
  elderAnswer   String?
  result        AnswerResult?
  recordingUrl  String?
  createdAt     DateTime         @default(now())
}
```

Also add these relations to the existing `ElderlyProfile` model:

```prisma
  assessmentQuestions AssessmentQuestion[]
  assessmentConfig    AssessmentConfig?
  assessmentSessions  AssessmentSession[]
```

**Step 2: Write the migration SQL**

Create `prisma/migrations/20260307220000_add_assessment_models/migration.sql`:

```sql
-- CreateEnum
CREATE TYPE "AssessmentCategory" AS ENUM ('PERSONAL', 'ORIENTATION', 'PEOPLE', 'GENERAL');
CREATE TYPE "AssessmentStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');
CREATE TYPE "AssessmentSeverity" AS ENUM ('GREEN', 'YELLOW', 'RED');
CREATE TYPE "AnswerResult" AS ENUM ('CORRECT', 'WRONG', 'UNCLEAR');

-- CreateTable
CREATE TABLE "AssessmentQuestion" (
    "id" TEXT NOT NULL,
    "elderlyProfileId" TEXT NOT NULL,
    "category" "AssessmentCategory" NOT NULL,
    "questionText" TEXT NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssessmentQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssessmentConfig" (
    "id" TEXT NOT NULL,
    "elderlyProfileId" TEXT NOT NULL,
    "scheduledTime" TEXT NOT NULL,
    "questionsPerCall" INTEGER NOT NULL DEFAULT 4,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssessmentConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssessmentSession" (
    "id" TEXT NOT NULL,
    "elderlyProfileId" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "overallScore" DOUBLE PRECISION,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'PENDING',
    "summary" TEXT,
    "severity" "AssessmentSeverity",
    "twilioCallSid" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssessmentSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssessmentAnswer" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "elderAnswer" TEXT,
    "result" "AnswerResult",
    "recordingUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssessmentAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentConfig_elderlyProfileId_key" ON "AssessmentConfig"("elderlyProfileId");

-- AddForeignKey
ALTER TABLE "AssessmentQuestion" ADD CONSTRAINT "AssessmentQuestion_elderlyProfileId_fkey" FOREIGN KEY ("elderlyProfileId") REFERENCES "ElderlyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentConfig" ADD CONSTRAINT "AssessmentConfig_elderlyProfileId_fkey" FOREIGN KEY ("elderlyProfileId") REFERENCES "ElderlyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentSession" ADD CONSTRAINT "AssessmentSession_elderlyProfileId_fkey" FOREIGN KEY ("elderlyProfileId") REFERENCES "ElderlyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentSession" ADD CONSTRAINT "AssessmentSession_configId_fkey" FOREIGN KEY ("configId") REFERENCES "AssessmentConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentAnswer" ADD CONSTRAINT "AssessmentAnswer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AssessmentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentAnswer" ADD CONSTRAINT "AssessmentAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "AssessmentQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

**Step 3: Regenerate Prisma client**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npx prisma generate`

**Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260307220000_add_assessment_models/
git commit -m "feat: add assessment database models"
```

---

### Task 2: Assessment API Routes — Questions & Config

**Files:**
- Create: `src/app/api/elderly/[id]/assessment/route.ts`
- Create: `src/app/api/elderly/[id]/assessment/questions/route.ts`

**Step 1: Create assessment config route**

Create `src/app/api/elderly/[id]/assessment/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getProfileAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";

// GET: fetch config + latest sessions
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const role = await getProfileAccess(user, id);
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const config = await prisma.assessmentConfig.findUnique({
    where: { elderlyProfileId: id },
  });

  const questions = await prisma.assessmentQuestion.findMany({
    where: { elderlyProfileId: id },
    orderBy: { createdAt: "asc" },
  });

  const sessions = await prisma.assessmentSession.findMany({
    where: { elderlyProfileId: id },
    include: { answers: true },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return NextResponse.json({ config, questions, sessions });
}

// PUT: update config (schedule time, active, questionsPerCall)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const role = await getProfileAccess(user, id);
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { scheduledTime, active, questionsPerCall } = await req.json();

  // Check minimum 10 questions before activating
  if (active) {
    const questionCount = await prisma.assessmentQuestion.count({
      where: { elderlyProfileId: id },
    });
    if (questionCount < 10) {
      return NextResponse.json(
        { error: "At least 10 questions with answers are required to activate assessment" },
        { status: 400 }
      );
    }
  }

  const config = await prisma.assessmentConfig.upsert({
    where: { elderlyProfileId: id },
    create: {
      elderlyProfileId: id,
      scheduledTime: scheduledTime || "09:00",
      questionsPerCall: questionsPerCall || 4,
      active: active || false,
    },
    update: {
      ...(scheduledTime !== undefined && { scheduledTime }),
      ...(active !== undefined && { active }),
      ...(questionsPerCall !== undefined && { questionsPerCall }),
    },
  });

  return NextResponse.json(config);
}
```

**Step 2: Create questions CRUD route**

Create `src/app/api/elderly/[id]/assessment/questions/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getProfileAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";

const DEFAULT_QUESTIONS = [
  { category: "PERSONAL", questionText: "What is your date of birth?" },
  { category: "PERSONAL", questionText: "What is your full name?" },
  { category: "PERSONAL", questionText: "What is your home address?" },
  { category: "PERSONAL", questionText: "What year were you born?" },
  { category: "PERSONAL", questionText: "What is your phone number?" },
  { category: "PERSONAL", questionText: "Where were you born?" },
  { category: "PERSONAL", questionText: "What is your wedding anniversary?" },
  { category: "PERSONAL", questionText: "What is your spouse's name?" },
  { category: "ORIENTATION", questionText: "What day of the week is it today?" },
  { category: "ORIENTATION", questionText: "What month are we in?" },
  { category: "ORIENTATION", questionText: "What year is it?" },
  { category: "ORIENTATION", questionText: "What season are we in?" },
  { category: "ORIENTATION", questionText: "What did you have for breakfast today?" },
  { category: "ORIENTATION", questionText: "What time of day is it — morning, afternoon, or evening?" },
  { category: "ORIENTATION", questionText: "What city do you live in?" },
  { category: "ORIENTATION", questionText: "What is today's date?" },
  { category: "PEOPLE", questionText: "What is your caregiver's name?" },
  { category: "PEOPLE", questionText: "What is your doctor's name?" },
  { category: "PEOPLE", questionText: "How many children do you have?" },
  { category: "PEOPLE", questionText: "What are your children's names?" },
  { category: "PEOPLE", questionText: "What is your son or daughter's birthday?" },
  { category: "PEOPLE", questionText: "Who visited you last?" },
  { category: "PEOPLE", questionText: "What is your best friend's name?" },
  { category: "GENERAL", questionText: "What country do you live in?" },
  { category: "GENERAL", questionText: "What is 5 plus 3?" },
  { category: "GENERAL", questionText: "What color is the sky?" },
  { category: "GENERAL", questionText: "How many days are in a week?" },
  { category: "GENERAL", questionText: "What do you use to brush your teeth?" },
  { category: "GENERAL", questionText: "What is the opposite of hot?" },
  { category: "GENERAL", questionText: "Name any three animals." },
] as const;

// POST: save/update all questions (bulk upsert)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const role = await getProfileAccess(user, id);
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { questions } = await req.json() as {
    questions: { id?: string; category: string; questionText: string; correctAnswer: string }[];
  };

  if (!questions || !Array.isArray(questions)) {
    return NextResponse.json({ error: "Questions array required" }, { status: 400 });
  }

  // Delete existing and replace
  await prisma.assessmentQuestion.deleteMany({
    where: { elderlyProfileId: id },
  });

  const created = await prisma.assessmentQuestion.createMany({
    data: questions.map((q) => ({
      elderlyProfileId: id,
      category: q.category as "PERSONAL" | "ORIENTATION" | "PEOPLE" | "GENERAL",
      questionText: q.questionText,
      correctAnswer: q.correctAnswer,
    })),
  });

  return NextResponse.json({ count: created.count });
}

// GET: get questions or initialize with defaults
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const role = await getProfileAccess(user, id);
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let questions = await prisma.assessmentQuestion.findMany({
    where: { elderlyProfileId: id },
    orderBy: { createdAt: "asc" },
  });

  // If no questions exist, return defaults (without saving)
  if (questions.length === 0) {
    return NextResponse.json({
      questions: DEFAULT_QUESTIONS.map((q, i) => ({
        id: `default-${i}`,
        ...q,
        correctAnswer: "",
        elderlyProfileId: id,
      })),
      isDefault: true,
    });
  }

  return NextResponse.json({ questions, isDefault: false });
}
```

**Step 3: Commit**

```bash
git add src/app/api/elderly/[id]/assessment/
git commit -m "feat: add assessment API routes for config and questions"
```

---

### Task 3: Assessment Gemini Functions

**Files:**
- Modify: `src/lib/gemini.ts`

**Step 1: Add assessment-specific Gemini functions**

Append to `src/lib/gemini.ts`:

```typescript
export async function generateAssessmentGreeting(context: {
  elderlyName: string;
  language: string;
  timeOfDay: string;
}): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `You are a caring, warm assistant calling an elderly person named ${context.elderlyName}.
Generate a short, friendly greeting for a daily cognitive check-in call in ${context.language === "ar" ? "Arabic" : "English"}.
Time of day: ${context.timeOfDay}.
Mention you'd like to ask a few simple questions to chat and check in on them.
Keep it under 3 sentences. Be warm and natural, not clinical.`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function generateAssessmentQuestionAudio(context: {
  elderlyName: string;
  questionText: string;
  questionNumber: number;
  totalQuestions: number;
  language: string;
}): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `You are having a warm phone conversation with ${context.elderlyName}.
Ask them this question naturally in ${context.language === "ar" ? "Arabic" : "English"}: "${context.questionText}"
This is question ${context.questionNumber} of ${context.totalQuestions}.
${context.questionNumber > 1 ? "Add a brief natural transition like 'Now...' or 'Next one...' or 'Okay...'" : ""}
Keep it to 1-2 sentences max. Be conversational, not like a test.`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function evaluateAssessmentAnswer(context: {
  questionText: string;
  correctAnswer: string;
  elderAnswer: string;
  language: string;
}): Promise<{ result: "CORRECT" | "WRONG" | "UNCLEAR"; response: string }> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `You are evaluating an elderly person's answer to a cognitive assessment question.

Question: "${context.questionText}"
Correct answer: "${context.correctAnswer}"
Elder's spoken answer (transcribed): "${context.elderAnswer}"

1. Determine if the answer is CORRECT, WRONG, or UNCLEAR (couldn't understand / no real answer).
   - Be lenient: partial matches, close approximations, or synonyms count as CORRECT.
   - For dates, accept different formats (e.g. "March 5" = "5th of March" = "3/5").
   - For names, accept nicknames or partial names.

2. Generate a short, warm response in ${context.language === "ar" ? "Arabic" : "English"}:
   - If CORRECT: Brief affirmation like "That's right!" or "Exactly!" (1 sentence)
   - If WRONG: Gently remind the correct answer, e.g. "Actually, it's [answer]. No worries!" (1-2 sentences)
   - If UNCLEAR: Say something like "I didn't quite catch that, but that's okay." (1 sentence)

Respond in this exact JSON format only, no markdown:
{"result": "CORRECT", "response": "That's right!"}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  // Strip markdown code fences if present
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned);
}

export async function generateAssessmentClosing(context: {
  elderlyName: string;
  score: number;
  totalQuestions: number;
  language: string;
}): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `You are ending a cognitive check-in phone call with ${context.elderlyName}.
They answered ${context.score} out of ${context.totalQuestions} questions correctly.
Generate a warm, encouraging closing in ${context.language === "ar" ? "Arabic" : "English"}.
${context.score === context.totalQuestions ? "They did perfectly — celebrate!" : context.score >= context.totalQuestions * 0.75 ? "They did great — be positive." : "Be extra encouraging and supportive, never discouraging."}
Keep it under 3 sentences. End with a goodbye.`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function generateAssessmentSummary(context: {
  elderlyName: string;
  date: string;
  answers: { questionText: string; correctAnswer: string; elderAnswer: string | null; result: string }[];
  language: string;
}): Promise<{ summary: string; severity: "GREEN" | "YELLOW" | "RED" }> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const correct = context.answers.filter((a) => a.result === "CORRECT").length;
  const total = context.answers.length;
  const score = total > 0 ? correct / total : 0;

  const prompt = `You are generating a caregiver report for ${context.elderlyName}'s daily cognitive assessment on ${context.date}.

Results:
${context.answers.map((a, i) => `${i + 1}. Q: "${a.questionText}" | Correct: "${a.correctAnswer}" | Answer: "${a.elderAnswer || "no response"}" | Result: ${a.result}`).join("\n")}

Score: ${correct}/${total} (${Math.round(score * 100)}%)

Write a brief 2-3 sentence summary for the caregiver in English. Be clinical but compassionate.
Note specific areas of strength or concern (e.g. "remembered all family names but struggled with dates").

Respond in this exact JSON format only, no markdown:
{"summary": "...", "severity": "${score >= 0.75 ? "GREEN" : score >= 0.5 ? "YELLOW" : "RED"}"}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned);
}
```

**Step 2: Commit**

```bash
git add src/lib/gemini.ts
git commit -m "feat: add Gemini functions for assessment evaluation and reporting"
```

---

### Task 4: Assessment Call Engine

**Files:**
- Create: `src/lib/assessment-call.ts`

**Step 1: Create the assessment call orchestrator**

This file manages initiating assessment calls and generating filler audio.

Create `src/lib/assessment-call.ts`:

```typescript
import { prisma } from "./prisma";
import { twilioClient } from "./twilio";
import { textToSpeech } from "./elevenlabs";
import { generateAssessmentGreeting, generateAssessmentQuestionAudio } from "./gemini";
import { writeFile, mkdir, access } from "fs/promises";
import path from "path";

const FILLER_PHRASES = [
  "Hmm, let me think...",
  "Okay...",
  "Alright...",
  "I see...",
  "Mm-hmm...",
];

async function ensureFillerAudio(voiceId: string): Promise<string[]> {
  const fillerDir = path.join(process.cwd(), "public", "audio", "fillers");
  await mkdir(fillerDir, { recursive: true });

  const urls: string[] = [];

  for (let i = 0; i < FILLER_PHRASES.length; i++) {
    const fileName = `filler-${voiceId.slice(0, 8)}-${i}.mp3`;
    const filePath = path.join(fillerDir, fileName);

    try {
      await access(filePath);
    } catch {
      // File doesn't exist, generate it
      const buffer = await textToSpeech(FILLER_PHRASES[i], voiceId);
      await writeFile(filePath, buffer);
    }

    urls.push(`${process.env.NEXT_PUBLIC_APP_URL}/api/audio/fillers/${fileName}`);
  }

  return urls;
}

export async function executeAssessmentCall(sessionId: string) {
  const session = await prisma.assessmentSession.findUnique({
    where: { id: sessionId },
    include: {
      elderlyProfile: true,
      config: true,
      answers: { include: { question: true } },
    },
  });

  if (!session || !session.elderlyProfile.phoneVerified) return;

  await prisma.assessmentSession.update({
    where: { id: sessionId },
    data: { status: "IN_PROGRESS" },
  });

  try {
    const profile = session.elderlyProfile;
    const voiceId = profile.voiceId || undefined;

    // Ensure filler audio exists for this voice
    const fillerUrls = await ensureFillerAudio(voiceId || "21m00Tcm4TlvDq8ikWAM");

    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

    // Generate greeting
    const greetingScript = await generateAssessmentGreeting({
      elderlyName: profile.name,
      language: profile.language,
      timeOfDay,
    });

    const greetingBuffer = await textToSpeech(greetingScript, voiceId);
    const audioDir = path.join(process.cwd(), "public", "audio");
    await mkdir(audioDir, { recursive: true });
    const greetingFileName = `assessment-greeting-${sessionId}.mp3`;
    await writeFile(path.join(audioDir, greetingFileName), greetingBuffer);
    const greetingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/audio/${greetingFileName}`;

    // Generate first question audio
    const firstAnswer = session.answers[0];
    const q1Script = await generateAssessmentQuestionAudio({
      elderlyName: profile.name,
      questionText: firstAnswer.questionText,
      questionNumber: 1,
      totalQuestions: session.answers.length,
      language: profile.language,
    });

    const q1Buffer = await textToSpeech(q1Script, voiceId);
    const q1FileName = `assessment-q-${firstAnswer.id}.mp3`;
    await writeFile(path.join(audioDir, q1FileName), q1Buffer);
    const q1Url = `${process.env.NEXT_PUBLIC_APP_URL}/api/audio/${q1FileName}`;

    // Build initial TwiML: greeting + first question + record
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
    const randomFiller = fillerUrls[Math.floor(Math.random() * fillerUrls.length)];

    const twiml = `<Response>
      <Play>${greetingUrl}</Play>
      <Pause length="1"/>
      <Play>${q1Url}</Play>
      <Record maxLength="15" playBeep="false" timeout="5" action="${baseUrl}/api/webhooks/assessment?sessionId=${sessionId}&amp;answerIndex=0&amp;fillerUrl=${encodeURIComponent(randomFiller)}" method="POST"/>
      <Say>I didn't hear anything. Let's move on.</Say>
      <Redirect method="POST">${baseUrl}/api/webhooks/assessment/next?sessionId=${sessionId}&amp;answerIndex=0</Redirect>
    </Response>`;

    const call = await twilioClient.calls.create({
      to: profile.phone,
      from: process.env.TWILIO_PHONE_NUMBER!,
      twiml,
      statusCallback: `${baseUrl}/api/webhooks/assessment/status?sessionId=${sessionId}`,
      statusCallbackEvent: ["completed"],
      statusCallbackMethod: "POST",
    });

    await prisma.assessmentSession.update({
      where: { id: sessionId },
      data: { twilioCallSid: call.sid },
    });
  } catch (error) {
    await prisma.assessmentSession.update({
      where: { id: sessionId },
      data: { status: "FAILED" },
    });
    console.error("Assessment call failed:", error);
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/assessment-call.ts
git commit -m "feat: add assessment call engine with filler audio"
```

---

### Task 5: Assessment Twilio Webhooks

**Files:**
- Create: `src/app/api/webhooks/assessment/route.ts`
- Create: `src/app/api/webhooks/assessment/next/route.ts`
- Create: `src/app/api/webhooks/assessment/status/route.ts`
- Create: `src/app/api/audio/[...path]/route.ts` (update existing audio route to support subdirs)

**Step 1: Create the main assessment webhook (receives recording)**

This webhook fires after each `<Record>`. It plays filler audio immediately, then processes the answer in background and redirects to the `/next` endpoint.

Create `src/app/api/webhooks/assessment/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { textToSpeech } from "@/lib/elevenlabs";
import { evaluateAssessmentAnswer, generateAssessmentQuestionAudio, generateAssessmentClosing, generateAssessmentSummary } from "@/lib/gemini";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const recordingUrl = formData.get("RecordingUrl") as string;
  const sessionId = req.nextUrl.searchParams.get("sessionId")!;
  const answerIndex = parseInt(req.nextUrl.searchParams.get("answerIndex") || "0");
  const fillerUrl = req.nextUrl.searchParams.get("fillerUrl")!;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  // Immediately respond with filler audio + redirect to /next (which will have the real response ready)
  // Store the recording URL so /next can process it
  const session = await prisma.assessmentSession.findUnique({
    where: { id: sessionId },
    include: { answers: { orderBy: { createdAt: "asc" } } },
  });

  if (!session || !session.answers[answerIndex]) {
    return new NextResponse("<Response><Say>Something went wrong. Goodbye.</Say></Response>", {
      headers: { "Content-Type": "text/xml" },
    });
  }

  // Save recording URL to the answer
  await prisma.assessmentAnswer.update({
    where: { id: session.answers[answerIndex].id },
    data: { recordingUrl: recordingUrl ? `${recordingUrl}.mp3` : null },
  });

  // Play filler and redirect to processing endpoint
  const twiml = `<Response>
    <Play>${fillerUrl}</Play>
    <Redirect method="POST">${baseUrl}/api/webhooks/assessment/next?sessionId=${sessionId}&amp;answerIndex=${answerIndex}&amp;recordingUrl=${encodeURIComponent(recordingUrl || "")}</Redirect>
  </Response>`;

  return new NextResponse(twiml, {
    headers: { "Content-Type": "text/xml" },
  });
}
```

**Step 2: Create the /next webhook (processes answer, plays response, asks next question)**

Create `src/app/api/webhooks/assessment/next/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { textToSpeech } from "@/lib/elevenlabs";
import {
  evaluateAssessmentAnswer,
  generateAssessmentQuestionAudio,
  generateAssessmentClosing,
  generateAssessmentSummary,
} from "@/lib/gemini";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

async function transcribeRecording(recordingUrl: string): Promise<string> {
  // Fetch audio from Twilio and send to Gemini for transcription
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const audioResponse = await fetch(`${recordingUrl}.mp3`, {
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
      ).toString("base64")}`,
    },
  });

  if (!audioResponse.ok) return "";

  const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
  const base64Audio = audioBuffer.toString("base64");

  const result = await model.generateContent([
    { text: "Transcribe the following audio recording. Return ONLY the transcription text, nothing else. If you cannot understand the audio, return 'UNCLEAR'." },
    { inlineData: { mimeType: "audio/mpeg", data: base64Audio } },
  ]);

  return result.response.text().trim();
}

export async function POST(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId")!;
  const answerIndex = parseInt(req.nextUrl.searchParams.get("answerIndex") || "0");
  const recordingUrl = req.nextUrl.searchParams.get("recordingUrl") || "";

  const session = await prisma.assessmentSession.findUnique({
    where: { id: sessionId },
    include: {
      answers: { orderBy: { createdAt: "asc" } },
      elderlyProfile: true,
    },
  });

  if (!session) {
    return new NextResponse("<Response><Say>Goodbye.</Say></Response>", {
      headers: { "Content-Type": "text/xml" },
    });
  }

  const currentAnswer = session.answers[answerIndex];
  const profile = session.elderlyProfile;
  const voiceId = profile.voiceId || undefined;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  const audioDir = path.join(process.cwd(), "public", "audio");
  await mkdir(audioDir, { recursive: true });

  // Transcribe the recording
  let elderAnswer = "";
  if (recordingUrl) {
    try {
      elderAnswer = await transcribeRecording(recordingUrl);
    } catch (err) {
      console.error("Transcription failed:", err);
      elderAnswer = "";
    }
  }

  // Evaluate the answer
  let result: "CORRECT" | "WRONG" | "UNCLEAR" = "UNCLEAR";
  let responseText = "I didn't quite catch that, but that's okay. Let's continue.";

  if (elderAnswer && elderAnswer !== "UNCLEAR") {
    try {
      const evaluation = await evaluateAssessmentAnswer({
        questionText: currentAnswer.questionText,
        correctAnswer: currentAnswer.correctAnswer,
        elderAnswer,
        language: profile.language,
      });
      result = evaluation.result;
      responseText = evaluation.response;
    } catch (err) {
      console.error("Evaluation failed:", err);
    }
  }

  // Save answer
  await prisma.assessmentAnswer.update({
    where: { id: currentAnswer.id },
    data: { elderAnswer: elderAnswer || null, result },
  });

  // Generate response audio
  const responseBuffer = await textToSpeech(responseText, voiceId);
  const responseFileName = `assessment-resp-${currentAnswer.id}.mp3`;
  await writeFile(path.join(audioDir, responseFileName), responseBuffer);
  const responseUrl = `${baseUrl}/api/audio/${responseFileName}`;

  const nextIndex = answerIndex + 1;
  const isLastQuestion = nextIndex >= session.answers.length;

  if (isLastQuestion) {
    // Generate closing
    const correctCount = await prisma.assessmentAnswer.count({
      where: { sessionId, result: "CORRECT" },
    });

    const closingScript = await generateAssessmentClosing({
      elderlyName: profile.name,
      score: correctCount + (result === "CORRECT" ? 1 : 0),
      totalQuestions: session.answers.length,
      language: profile.language,
    });

    const closingBuffer = await textToSpeech(closingScript, voiceId);
    const closingFileName = `assessment-closing-${sessionId}.mp3`;
    await writeFile(path.join(audioDir, closingFileName), closingBuffer);
    const closingUrl = `${baseUrl}/api/audio/${closingFileName}`;

    // Generate report
    const allAnswers = await prisma.assessmentAnswer.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
    });

    const totalCorrect = allAnswers.filter((a) => a.result === "CORRECT").length;
    const score = allAnswers.length > 0 ? totalCorrect / allAnswers.length : 0;

    const todayStr = new Date().toLocaleDateString("en-CA");

    try {
      const report = await generateAssessmentSummary({
        elderlyName: profile.name,
        date: todayStr,
        answers: allAnswers.map((a) => ({
          questionText: a.questionText,
          correctAnswer: a.correctAnswer,
          elderAnswer: a.elderAnswer,
          result: a.result || "UNCLEAR",
        })),
        language: profile.language,
      });

      await prisma.assessmentSession.update({
        where: { id: sessionId },
        data: {
          status: "COMPLETED",
          overallScore: score,
          summary: report.summary,
          severity: report.severity,
        },
      });
    } catch {
      await prisma.assessmentSession.update({
        where: { id: sessionId },
        data: {
          status: "COMPLETED",
          overallScore: score,
          severity: score >= 0.75 ? "GREEN" : score >= 0.5 ? "YELLOW" : "RED",
        },
      });
    }

    const twiml = `<Response>
      <Play>${responseUrl}</Play>
      <Pause length="1"/>
      <Play>${closingUrl}</Play>
    </Response>`;

    return new NextResponse(twiml, {
      headers: { "Content-Type": "text/xml" },
    });
  }

  // Generate next question audio
  const nextAnswer = session.answers[nextIndex];
  const nextQScript = await generateAssessmentQuestionAudio({
    elderlyName: profile.name,
    questionText: nextAnswer.questionText,
    questionNumber: nextIndex + 1,
    totalQuestions: session.answers.length,
    language: profile.language,
  });

  const nextQBuffer = await textToSpeech(nextQScript, voiceId);
  const nextQFileName = `assessment-q-${nextAnswer.id}.mp3`;
  await writeFile(path.join(audioDir, nextQFileName), nextQBuffer);
  const nextQUrl = `${baseUrl}/api/audio/${nextQFileName}`;

  // Pick random filler for next round
  const fillerIndex = Math.floor(Math.random() * 5);
  const fillerVoice = (voiceId || "21m00Tcm4TlvDq8ikWAM").slice(0, 8);
  const nextFillerUrl = `${baseUrl}/api/audio/fillers/filler-${fillerVoice}-${fillerIndex}.mp3`;

  const twiml = `<Response>
    <Play>${responseUrl}</Play>
    <Pause length="1"/>
    <Play>${nextQUrl}</Play>
    <Record maxLength="15" playBeep="false" timeout="5" action="${baseUrl}/api/webhooks/assessment?sessionId=${sessionId}&amp;answerIndex=${nextIndex}&amp;fillerUrl=${encodeURIComponent(nextFillerUrl)}" method="POST"/>
    <Say>I didn't hear anything. Let's move on.</Say>
    <Redirect method="POST">${baseUrl}/api/webhooks/assessment/next?sessionId=${sessionId}&amp;answerIndex=${nextIndex}</Redirect>
  </Response>`;

  return new NextResponse(twiml, {
    headers: { "Content-Type": "text/xml" },
  });
}
```

**Step 3: Create status webhook**

Create `src/app/api/webhooks/assessment/status/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const callStatus = formData.get("CallStatus") as string;
  const sessionId = req.nextUrl.searchParams.get("sessionId");

  if (!sessionId) return NextResponse.json({ ok: true });

  const session = await prisma.assessmentSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) return NextResponse.json({ ok: true });

  // Only update if not already completed
  if (session.status !== "COMPLETED") {
    if (callStatus === "completed" || callStatus === "no-answer" || callStatus === "busy" || callStatus === "failed") {
      await prisma.assessmentSession.update({
        where: { id: sessionId },
        data: { status: session.status === "IN_PROGRESS" ? "COMPLETED" : "FAILED" },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
```

**Step 4: Update audio route to support subdirectories**

The current audio route at `src/app/api/audio/[filename]/route.ts` only serves files from `public/audio/`. We need it to also serve `public/audio/fillers/`. Rename/replace it with a catch-all route.

Read the existing route first, then replace `src/app/api/audio/[filename]/route.ts` with a catch-all at `src/app/api/audio/[...path]/route.ts`.

Delete `src/app/api/audio/[filename]/route.ts` and create `src/app/api/audio/[...path]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  const filePath = segments.join("/");

  // Validate: only allow alphanumeric, hyphens, dots, and forward slashes
  if (!/^[a-zA-Z0-9\-/.]+\.mp3$/.test(filePath)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  // Prevent directory traversal
  if (filePath.includes("..")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const fullPath = path.join(process.cwd(), "public", "audio", filePath);

  try {
    const buffer = await readFile(fullPath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
```

**Step 5: Commit**

```bash
git add src/app/api/webhooks/assessment/ src/app/api/audio/
git commit -m "feat: add assessment webhooks and update audio route for subdirs"
```

---

### Task 6: Cron Worker — Assessment Scheduling

**Files:**
- Modify: `src/cron/worker.ts`

**Step 1: Add assessment processing to the cron worker**

Add import at top of `src/cron/worker.ts`:

```typescript
import { executeAssessmentCall } from "../lib/assessment-call";
```

Add this function before the `cron.schedule` call:

```typescript
async function processAssessments() {
  const configs = await prisma.assessmentConfig.findMany({
    where: {
      active: true,
      elderlyProfile: { phoneVerified: true },
    },
    include: { elderlyProfile: true },
  });

  for (const config of configs) {
    const tz = config.elderlyProfile.timezone || "UTC";
    const currentTime = getTimeInTimezone(tz);

    if (config.scheduledTime !== currentTime) continue;

    const todayStr = getTodayDateStringInTimezone(tz);

    // Check if already assessed today
    const existingSession = await prisma.assessmentSession.findFirst({
      where: { configId: config.id, date: todayStr },
    });
    if (existingSession) continue;

    // Pick random questions
    const allQuestions = await prisma.assessmentQuestion.findMany({
      where: { elderlyProfileId: config.elderlyProfileId },
    });

    if (allQuestions.length < 10) continue;

    // Shuffle and pick N questions
    const shuffled = allQuestions.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, config.questionsPerCall);

    // Create session with pre-created answers
    const session = await prisma.assessmentSession.create({
      data: {
        elderlyProfileId: config.elderlyProfileId,
        configId: config.id,
        date: todayStr,
        status: "PENDING",
        answers: {
          create: selected.map((q) => ({
            questionId: q.id,
            questionText: q.questionText,
            correctAnswer: q.correctAnswer,
          })),
        },
      },
    });

    console.log(`Triggering assessment call for ${config.elderlyProfile.name}`);
    await executeAssessmentCall(session.id);
  }
}
```

Add `processAssessments()` call inside the existing `cron.schedule` callback, after `processEmergencyCalls()`:

```typescript
await processAssessments();
```

**Step 2: Commit**

```bash
git add src/cron/worker.ts
git commit -m "feat: add assessment scheduling to cron worker"
```

---

### Task 7: Assessment UI Page

**Files:**
- Create: `src/app/elderly/[id]/assessment/page.tsx`

**Step 1: Create the assessment page**

This is the largest UI component. It has three sections: Setup (questions + schedule), Latest Report, and History.

Create `src/app/elderly/[id]/assessment/page.tsx`:

```typescript
"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface Question {
  id: string;
  category: string;
  questionText: string;
  correctAnswer: string;
}

interface Answer {
  id: string;
  questionText: string;
  correctAnswer: string;
  elderAnswer: string | null;
  result: string | null;
  recordingUrl: string | null;
}

interface Session {
  id: string;
  date: string;
  overallScore: number | null;
  status: string;
  summary: string | null;
  severity: string | null;
  answers: Answer[];
  createdAt: string;
}

interface Config {
  id: string;
  scheduledTime: string;
  questionsPerCall: number;
  active: boolean;
}

const CATEGORIES = ["PERSONAL", "ORIENTATION", "PEOPLE", "GENERAL"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  PERSONAL: "Personal",
  ORIENTATION: "Daily Orientation",
  PEOPLE: "People Recognition",
  GENERAL: "General Knowledge",
};

export default function AssessmentPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"setup" | "reports">("reports");

  const fetchData = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/elderly/${id}/assessment`);
      if (!res.ok) throw new Error("Failed to load assessment data");
      const data = await res.json();
      setConfig(data.config);
      setSessions(data.sessions || []);

      if (data.questions.length > 0) {
        setQuestions(data.questions);
      } else {
        // Load defaults
        const qRes = await apiFetch(`/api/elderly/${id}/assessment/questions`);
        if (qRes.ok) {
          const qData = await qRes.json();
          setQuestions(qData.questions);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!authLoading && !user) { router.push("/login"); return; }
    if (user && id) fetchData();
  }, [user, authLoading, router, id, fetchData]);

  function updateQuestion(index: number, field: "questionText" | "correctAnswer", value: string) {
    setQuestions((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  async function saveQuestions() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await apiFetch(`/api/elderly/${id}/assessment/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }
      setSuccess("Questions saved successfully");
      // Reload to get real IDs
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function updateConfig(updates: Partial<Config>) {
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch(`/api/elderly/${id}/assessment`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update");
      }
      const updated = await res.json();
      setConfig(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  const filledCount = questions.filter((q) => q.correctAnswer.trim()).length;
  const latestSession = sessions[0];

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/elderly/${id}`}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          &larr; Back
        </Link>
        <h1 className="text-xl font-bold text-gray-900 flex-1">Cognitive Assessment</h1>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {success && (
        <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        <button
          onClick={() => setActiveTab("reports")}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === "reports" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Reports
        </button>
        <button
          onClick={() => setActiveTab("setup")}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === "setup" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Setup
        </button>
      </div>

      {activeTab === "setup" && (
        <>
          {/* Schedule Config */}
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Schedule</h2>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Daily Call Time</label>
                <input
                  type="time"
                  value={config?.scheduledTime || "09:00"}
                  onChange={(e) => updateConfig({ scheduledTime: e.target.value })}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Questions Per Call</label>
                <select
                  value={config?.questionsPerCall || 4}
                  onChange={(e) => updateConfig({ questionsPerCall: parseInt(e.target.value) })}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                  <option value={5}>5</option>
                </select>
              </div>
              <button
                onClick={() => updateConfig({ active: !config?.active })}
                disabled={saving || (!config?.active && filledCount < 10)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  config?.active
                    ? "bg-red-100 text-red-700 hover:bg-red-200"
                    : "bg-green-600 text-white hover:bg-green-700"
                }`}
              >
                {config?.active ? "Deactivate" : "Activate"}
              </button>
            </div>
            {!config?.active && filledCount < 10 && (
              <p className="mt-2 text-xs text-amber-600">
                Fill in at least 10 correct answers to activate ({filledCount}/10 filled)
              </p>
            )}
            {config?.active && (
              <p className="mt-2 text-xs text-green-600">
                Assessment calls active daily at {config.scheduledTime}
              </p>
            )}
          </section>

          {/* Questions */}
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Questions ({filledCount}/30 answered)</h2>
              <button
                onClick={saveQuestions}
                disabled={saving}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving..." : "Save Questions"}
              </button>
            </div>

            {CATEGORIES.map((cat) => (
              <div key={cat} className="mb-6 last:mb-0">
                <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                  {CATEGORY_LABELS[cat]}
                </h3>
                <div className="space-y-3">
                  {questions
                    .map((q, i) => ({ q, i }))
                    .filter(({ q }) => q.category === cat)
                    .map(({ q, i }) => (
                      <div key={q.id} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          value={q.questionText}
                          onChange={(e) => updateQuestion(i, "questionText", e.target.value)}
                          className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 bg-gray-50 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          placeholder="Question"
                        />
                        <input
                          value={q.correctAnswer}
                          onChange={(e) => updateQuestion(i, "correctAnswer", e.target.value)}
                          className={`rounded-lg border px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                            q.correctAnswer.trim() ? "border-green-300 bg-green-50" : "border-gray-300"
                          }`}
                          placeholder="Correct answer"
                        />
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </section>
        </>
      )}

      {activeTab === "reports" && (
        <>
          {/* Latest Report */}
          {latestSession && latestSession.status === "COMPLETED" ? (
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Latest Assessment</h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">{latestSession.date}</span>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      latestSession.severity === "GREEN"
                        ? "bg-green-100 text-green-700"
                        : latestSession.severity === "YELLOW"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {Math.round((latestSession.overallScore || 0) * 100)}%
                  </span>
                </div>
              </div>
              {latestSession.summary && (
                <p className="text-sm text-gray-700 mb-4">{latestSession.summary}</p>
              )}
              <div className="space-y-2">
                {latestSession.answers.map((a, i) => (
                  <div key={a.id} className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                        a.result === "CORRECT"
                          ? "bg-green-100 text-green-700"
                          : a.result === "WRONG"
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{a.questionText}</p>
                      <p className="text-xs text-gray-500">
                        Correct: {a.correctAnswer}
                        {a.elderAnswer && (
                          <> &middot; Answer: <span className={a.result === "CORRECT" ? "text-green-600" : "text-red-600"}>{a.elderAnswer}</span></>
                        )}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        a.result === "CORRECT" ? "text-green-600" : a.result === "WRONG" ? "text-red-600" : "text-gray-400"
                      }`}
                    >
                      {a.result || "—"}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-gray-500 text-center py-4">
                {sessions.length === 0
                  ? "No assessments yet. Set up questions and activate to start."
                  : latestSession?.status === "IN_PROGRESS"
                  ? "Assessment call in progress..."
                  : latestSession?.status === "PENDING"
                  ? "Assessment call pending..."
                  : "Latest assessment failed."}
              </p>
            </section>
          )}

          {/* History */}
          {sessions.length > 1 && (
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">History</h2>

              {/* Score trend (simple bar chart) */}
              <div className="flex items-end gap-1 h-20 mb-6">
                {[...sessions].reverse().map((s) => {
                  const pct = Math.round((s.overallScore || 0) * 100);
                  return (
                    <div key={s.id} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className={`w-full rounded-t ${
                          s.severity === "GREEN"
                            ? "bg-green-400"
                            : s.severity === "YELLOW"
                            ? "bg-yellow-400"
                            : s.severity === "RED"
                            ? "bg-red-400"
                            : "bg-gray-200"
                        }`}
                        style={{ height: `${Math.max(pct, 5)}%` }}
                        title={`${s.date}: ${pct}%`}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Session list */}
              <div className="space-y-2">
                {sessions.map((s) => (
                  <div key={s.id}>
                    <button
                      onClick={() => setExpandedSession(expandedSession === s.id ? null : s.id)}
                      className="w-full flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
                    >
                      <span className="text-sm text-gray-900">{s.date}</span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            s.severity === "GREEN"
                              ? "bg-green-100 text-green-700"
                              : s.severity === "YELLOW"
                              ? "bg-yellow-100 text-yellow-700"
                              : s.severity === "RED"
                              ? "bg-red-100 text-red-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {s.status === "COMPLETED" ? `${Math.round((s.overallScore || 0) * 100)}%` : s.status}
                        </span>
                        <svg
                          className={`h-4 w-4 text-gray-400 transition-transform ${expandedSession === s.id ? "rotate-180" : ""}`}
                          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                        </svg>
                      </div>
                    </button>
                    {expandedSession === s.id && (
                      <div className="px-3 pb-3">
                        {s.summary && <p className="text-sm text-gray-600 mb-2">{s.summary}</p>}
                        {s.answers.map((a, i) => (
                          <div key={a.id} className="flex items-center gap-2 py-1 text-xs text-gray-600">
                            <span className={`font-medium ${a.result === "CORRECT" ? "text-green-600" : a.result === "WRONG" ? "text-red-600" : "text-gray-400"}`}>
                              {a.result === "CORRECT" ? "✓" : a.result === "WRONG" ? "✗" : "?"}
                            </span>
                            <span>{a.questionText}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/elderly/[id]/assessment/
git commit -m "feat: add assessment UI page with setup, reports, and history"
```

---

### Task 8: Link Assessment Page from Elder Profile

**Files:**
- Modify: `src/app/elderly/[id]/page.tsx`

**Step 1: Add assessment link to the elder profile page**

Add a link button in the profile page, similar to "Manage Medications & Reminders" and "View Call History". Add it after the Reminders section:

```typescript
<Link
  href={`/elderly/${id}/assessment`}
  className={`rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors ${allVerified ? "hover:bg-emerald-700" : "pointer-events-none opacity-50"}`}
  aria-disabled={!allVerified}
  tabIndex={!allVerified ? -1 : undefined}
>
  Cognitive Assessment
</Link>
```

**Step 2: Commit**

```bash
git add src/app/elderly/[id]/page.tsx
git commit -m "feat: add cognitive assessment link to elder profile page"
```

---

### Task 9: Delete Old Audio Route & Final Cleanup

**Files:**
- Delete: `src/app/api/audio/[filename]/route.ts`
- Verify: TypeScript compiles cleanly

**Step 1: Remove old audio route**

```bash
rm src/app/api/audio/\[filename\]/route.ts
rmdir src/app/api/audio/\[filename\]/
```

**Step 2: Type-check**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: clean up old audio route, final type-check"
```

---

### Task 10: Push to Deploy

```bash
git push origin main
```

The deploy workflow will automatically run `prisma migrate deploy` on the server.
