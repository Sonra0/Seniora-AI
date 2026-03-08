# Warm Assessment Call Flow — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure the assessment call to feel like a warm, energetic conversation — with emotional check-in branching (positive → encouragement, negative → Telegram alert + emergency call offer) and a review of cognitive answers at the end.

**Architecture:** The call flow becomes a multi-phase TwiML state machine: questions → emotional check-in → (optional) emergency ask → answer review → goodbye. Emotional response is evaluated mid-call via Gemini. Answer evaluations run in background from question 1 so they're ready by review time. New audio is generated on-the-fly with ElevenLabs TTS, falling back to Twilio `<Say>`.

**Tech Stack:** Next.js API routes (TwiML), Gemini 2.5 Flash, ElevenLabs TTS, Twilio, Prisma, Telegram Bot API

---

## Call Flow Diagram

```
Greeting (warm, energetic)
  ↓
Q1 → Record → [bg: transcribe+evaluate] → Q2 → ... → Qn
  ↓
Emotional check-in: "How are you feeling today?"
  ↓ (Gather speech)
Gemini evaluates → POSITIVE or NEGATIVE
  ↓                          ↓
POSITIVE                   NEGATIVE
  ↓                          ↓
Warm encouragement      1. Send Telegram alert to all caregivers
  ↓                     2. Ask: "Would you like me to call someone for you?"
  ↓                          ↓ (Gather speech)
  ↓                     YES → Call emergency contact + reassurance
  ↓                     NO  → Supportive message
  ↓                          ↓
  ←←←←←←←←←←←←←←←←←←←←←←←←←
  ↓
Answer Review (evaluations ready by now)
  - Go through each question warmly
  - Celebrate correct, gently correct wrong
  ↓
Warm goodbye + session completion
  ↓ (background)
Generate summary + vocal analysis + Telegram report
```

---

### Task 1: Add `evaluateEmotionalResponse` to Gemini lib

**Files:**
- Modify: `src/lib/gemini.ts` (append new function after `generateAssessmentClosing`)

**Step 1: Add the function**

Add this function to the end of `gemini.ts` (before the `parseCareCommand` section):

```typescript
export async function evaluateEmotionalResponse(context: {
  elderlyName: string;
  emotionalAnswer: string;
  language: string;
}): Promise<{ sentiment: "POSITIVE" | "NEGATIVE"; response: string }> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const lang = context.language === "ar" ? "Arabic" : "English";
  const prompt = `You are a warm, caring assistant on a phone call with an elderly person named ${context.elderlyName}.
They were just asked "How are you feeling today?" and responded: "${context.emotionalAnswer}"

1. Determine if their emotional state is POSITIVE or NEGATIVE.
   - POSITIVE: they feel fine, good, happy, okay, content, or neutral.
   - NEGATIVE: they feel sad, lonely, anxious, scared, unwell, in pain, confused, or distressed.
   - When in doubt, lean toward POSITIVE.

2. Generate a warm, empathetic spoken response in ${lang}:
   - If POSITIVE: A brief, cheerful, encouraging response (1-2 sentences). Be energetic and uplifting!
   - If NEGATIVE: A brief, deeply compassionate response acknowledging their feelings (1-2 sentences). Be gentle and caring. Do NOT mention emergency calls — that will be handled separately.

Respond in this exact JSON format only, no markdown:
{"sentiment": "POSITIVE", "response": "That's wonderful to hear! I'm so glad you're doing well today."}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned);
}
```

**Step 2: Add `generateAnswerReview` function**

Add this function right after `evaluateEmotionalResponse`:

```typescript
export async function generateAnswerReview(context: {
  elderlyName: string;
  answers: { questionText: string; correctAnswer: string; elderAnswer: string | null; result: string | null }[];
  language: string;
}): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const lang = context.language === "ar" ? "Arabic" : "English";
  const totalCorrect = context.answers.filter(a => a.result === "CORRECT").length;

  const prompt = `You are a warm, energetic, caring assistant on the phone with ${context.elderlyName}.
You just finished a fun cognitive check-in. Now review their answers conversationally in ${lang}.

Results:
${context.answers.map((a, i) => `Q${i + 1}: "${a.questionText}" | Correct: "${a.correctAnswer}" | Their answer: "${a.elderAnswer || "no answer"}" | ${a.result}`).join("\n")}

Score: ${totalCorrect}/${context.answers.length}

Guidelines:
- Start with an encouraging opener about how they did overall.
- For CORRECT answers: celebrate briefly ("You nailed that one!" / "Exactly right!").
- For WRONG answers: gently share the correct answer without making them feel bad ("That one was tricky — it's actually [answer]").
- For UNCLEAR: skip gracefully ("I couldn't quite catch that one, but no worries").
- End with a warm, uplifting goodbye. Tell them to take care and you'll talk again soon.
- Keep the whole thing under 200 words. Be conversational, not like reading a report.
- Be energetic and positive throughout!

Return ONLY the spoken text, no JSON, no formatting.`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}
```

**Step 3: Commit**

```bash
git add src/lib/gemini.ts
git commit -m "feat: add evaluateEmotionalResponse and generateAnswerReview Gemini functions"
```

---

### Task 2: Pre-generate emergency-ask audio in assessment-call.ts

**Files:**
- Modify: `src/lib/assessment-call.ts`

**Step 1: Add emergency-ask audio pre-generation**

In `executeAssessmentCall`, after the existing `didntHearShortAudioPromise` block (around line 84-89), add a new audio pre-generation for the emergency ask question:

```typescript
const emergencyAskAudioPromise = (async () => {
  const emergencyAskText = isArabic
    ? "أنا آسف لسماع ذلك. هل تريد أن أتصل بشخص من عائلتك أو طبيبك الآن؟"
    : "I'm sorry to hear that. Would you like me to call someone from your family or your doctor right now?";
  const buf = await textToSpeech(emergencyAskText, voiceId);
  const fileName = `assessment-emergency-ask-${sessionId}.mp3`;
  await writeFile(path.join(audioDir, fileName), buf);
  return fileName;
})();
```

**Step 2: Add it to the Promise.all**

Update the `Promise.all` (around line 91-96) to include the new promise:

```typescript
const [questionUrls, emotionalFileName, didntHearFileName, didntHearShortFileName, emergencyAskFileName] = await Promise.all([
  Promise.all(questionAudioPromises),
  emotionalAudioPromise,
  didntHearAudioPromise,
  didntHearShortAudioPromise,
  emergencyAskAudioPromise,
]);
```

**Step 3: Update the emotional question text to be warmer**

Replace the existing `emotionalQText` (line 62-64) with:

```typescript
const emotionalQText = isArabic
  ? "أحسنت! الآن أخبرني، كيف حالك اليوم؟ كيف تشعر؟"
  : "Great job with those! Now tell me, how are you doing today? How are you feeling?";
```

**Step 4: Commit**

```bash
git add src/lib/assessment-call.ts
git commit -m "feat: pre-generate emergency-ask audio and warmer emotional question"
```

---

### Task 3: Restructure the assessment next webhook — emotional phase

**Files:**
- Modify: `src/app/api/webhooks/assessment/next/route.ts`

**Step 1: Add imports**

Add to the existing imports at the top:

```typescript
import {
  evaluateAssessmentAnswer,
  generateAssessmentQuestionAudio,
  generateAssessmentSummary,
  analyzeVocalBiomarkers,
  evaluateEmotionalResponse,
  generateAnswerReview,
} from "@/lib/gemini";
import { twilioClient } from "@/lib/twilio";
```

(Update the existing gemini import to include the two new functions, and add the twilio import.)

**Step 2: Rewrite the `phase === "emotional"` block**

Replace the entire `if (phase === "emotional") { ... }` block (lines 254-335) with:

```typescript
if (phase === "emotional") {
  const emotionalAnswer = (formData?.get("SpeechResult") as string) || "";

  // Save emotional response
  prisma.assessmentSession.update({
    where: { id: sessionId },
    data: { emotionalResponse: emotionalAnswer || null },
  }).catch((err: unknown) => console.error("Emotional save failed:", err));

  const isArabic = profile.language === "ar";
  const lang = isArabic ? "ar-SA" : "en-US";
  const voiceId = profile.voiceId || undefined;
  await mkdir(audioDir, { recursive: true });

  // Evaluate emotional response with Gemini
  let sentiment: "POSITIVE" | "NEGATIVE" = "POSITIVE";
  let emotionalResponseText = isArabic
    ? "هذا رائع! سعيد أنك بخير."
    : "That's great to hear! I'm glad you're doing well.";

  if (emotionalAnswer && emotionalAnswer !== "UNCLEAR") {
    try {
      const evaluation = await evaluateEmotionalResponse({
        elderlyName: profile.name,
        emotionalAnswer,
        language: profile.language,
      });
      sentiment = evaluation.sentiment;
      emotionalResponseText = evaluation.response;
    } catch (err) {
      console.error("Emotional evaluation failed:", err);
    }
  }

  // Generate TTS for the emotional response
  let responseAudioTag: string;
  try {
    const buf = await textToSpeech(emotionalResponseText, voiceId);
    const fileName = `assessment-emotional-resp-${sessionId}.mp3`;
    await writeFile(path.join(audioDir, fileName), buf);
    responseAudioTag = `<Play>${baseUrl}/api/audio/${fileName}</Play>`;
  } catch {
    responseAudioTag = `<Say>${emotionalResponseText}</Say>`;
  }

  if (sentiment === "NEGATIVE") {
    // Send Telegram alert to all caregivers
    try {
      await sendTelegramNotification(
        profile.id,
        `⚠️ *Emotional Alert: ${profile.name}*\n\n${profile.name} expressed feeling unwell during today's assessment call.\n\nWhat they said: "${emotionalAnswer}"\n\nPlease check in on them.`
      );
    } catch (err) {
      console.error("Telegram emotional alert failed:", err);
    }

    // Play concerned response, then ask about emergency call
    const emergencyAskFile = `assessment-emergency-ask-${sessionId}.mp3`;
    let emergencyAskTag: string;
    try {
      await access(path.join(audioDir, emergencyAskFile));
      emergencyAskTag = `<Play>${baseUrl}/api/audio/${emergencyAskFile}</Play>`;
    } catch {
      const askText = isArabic
        ? "هل تريد أن أتصل بشخص من عائلتك أو طبيبك الآن؟"
        : "Would you like me to call someone from your family or your doctor right now?";
      emergencyAskTag = `<Say>${askText}</Say>`;
    }

    const twiml = `<Response>
      ${responseAudioTag}
      <Pause length="1"/>
      ${emergencyAskTag}
      <Gather input="speech" speechTimeout="3" language="${lang}" action="${baseUrl}/api/webhooks/assessment/next?sessionId=${sessionId}&amp;answerIndex=${answerIndex}&amp;phase=emergency-ask" method="POST">
      </Gather>
      <Redirect method="POST">${baseUrl}/api/webhooks/assessment/next?sessionId=${sessionId}&amp;answerIndex=${answerIndex}&amp;phase=emergency-ask</Redirect>
    </Response>`;

    return new NextResponse(twiml, {
      headers: { "Content-Type": "text/xml" },
    });
  }

  // POSITIVE — say something warm, go straight to review
  const twiml = `<Response>
    ${responseAudioTag}
    <Redirect method="POST">${baseUrl}/api/webhooks/assessment/next?sessionId=${sessionId}&amp;answerIndex=${answerIndex}&amp;phase=review</Redirect>
  </Response>`;

  return new NextResponse(twiml, {
    headers: { "Content-Type": "text/xml" },
  });
}
```

**Step 3: Commit**

```bash
git add src/app/api/webhooks/assessment/next/route.ts
git commit -m "feat: emotional phase evaluates sentiment, branches to emergency or review"
```

---

### Task 4: Add emergency-ask phase to next webhook

**Files:**
- Modify: `src/app/api/webhooks/assessment/next/route.ts`

**Step 1: Add the emergency-ask phase handler**

Add this block right after the `if (phase === "emotional") { ... }` block and before the cognitive questions section:

```typescript
// ============================================================
// PHASE: EMERGENCY-ASK — user answered yes/no to emergency call
// ============================================================
if (phase === "emergency-ask") {
  const emergencyAnswer = (formData?.get("SpeechResult") as string) || "";
  const isArabic = profile.language === "ar";
  const voiceId = profile.voiceId || undefined;
  await mkdir(audioDir, { recursive: true });

  // Determine if they said yes or no
  const normalizedAnswer = emergencyAnswer.toLowerCase().trim();
  const yesPatterns = isArabic
    ? ["نعم", "أيوا", "إيه", "اه", "أي", "طبعا", "بلى"]
    : ["yes", "yeah", "yep", "please", "sure", "ok", "okay", "ya"];
  const wantsEmergency = yesPatterns.some(p => normalizedAnswer.includes(p));

  if (wantsEmergency && profile.emergencyPhone) {
    // Trigger emergency call in background
    const { callEmergencyContact } = await import("@/lib/voice-call");
    callEmergencyContact(profile.id);

    // Send Telegram notification about emergency call
    try {
      await sendTelegramNotification(
        profile.id,
        `🚨 *Emergency Call Triggered: ${profile.name}*\n\n${profile.name} requested an emergency call during their assessment. Calling emergency contact (${profile.emergencyContact || profile.emergencyPhone}) now.`
      );
    } catch (err) {
      console.error("Telegram emergency notification failed:", err);
    }

    // Reassure the elder
    const reassureText = isArabic
      ? "لا تقلق، سأتصل بهم الآن. سيتواصلون معك قريباً. الآن دعنا نراجع إجاباتك معاً."
      : "Don't worry, I'm calling them right now. They'll reach out to you soon. Now let's go over your answers together.";

    let reassureTag: string;
    try {
      const buf = await textToSpeech(reassureText, voiceId);
      const fileName = `assessment-reassure-${sessionId}.mp3`;
      await writeFile(path.join(audioDir, fileName), buf);
      reassureTag = `<Play>${baseUrl}/api/audio/${fileName}</Play>`;
    } catch {
      reassureTag = `<Say>${reassureText}</Say>`;
    }

    const twiml = `<Response>
      ${reassureTag}
      <Redirect method="POST">${baseUrl}/api/webhooks/assessment/next?sessionId=${sessionId}&amp;answerIndex=${answerIndex}&amp;phase=review</Redirect>
    </Response>`;

    return new NextResponse(twiml, {
      headers: { "Content-Type": "text/xml" },
    });
  }

  // They said no or no emergency contact — be supportive, move to review
  const supportText = isArabic
    ? "حسناً، إذا احتجت أي شيء لا تتردد. أنا هنا دائماً. الآن دعنا نراجع إجاباتك!"
    : "Okay, that's alright. If you ever need anything, don't hesitate. I'm always here for you. Now let's go over your answers!";

  let supportTag: string;
  try {
    const buf = await textToSpeech(supportText, voiceId);
    const fileName = `assessment-support-${sessionId}.mp3`;
    await writeFile(path.join(audioDir, fileName), buf);
    supportTag = `<Play>${baseUrl}/api/audio/${fileName}</Play>`;
  } catch {
    supportTag = `<Say>${supportText}</Say>`;
  }

  const twiml = `<Response>
    ${supportTag}
    <Redirect method="POST">${baseUrl}/api/webhooks/assessment/next?sessionId=${sessionId}&amp;answerIndex=${answerIndex}&amp;phase=review</Redirect>
  </Response>`;

  return new NextResponse(twiml, {
    headers: { "Content-Type": "text/xml" },
  });
}
```

**Step 2: Commit**

```bash
git add src/app/api/webhooks/assessment/next/route.ts
git commit -m "feat: add emergency-ask phase with emergency call trigger"
```

---

### Task 5: Add review phase to next webhook

**Files:**
- Modify: `src/app/api/webhooks/assessment/next/route.ts`

**Step 1: Add the review phase handler**

Add this block right after the `if (phase === "emergency-ask") { ... }` block:

```typescript
// ============================================================
// PHASE: REVIEW — go through answers warmly, then goodbye
// ============================================================
if (phase === "review") {
  const voiceId = profile.voiceId || undefined;
  await mkdir(audioDir, { recursive: true });

  // Wait for background evaluations to finish (they started during questions)
  await sleep(2000);

  // Fetch evaluated answers
  const answers = await prisma.assessmentAnswer.findMany({
    where: { sessionId },
    orderBy: { orderIndex: "asc" },
  });

  const totalCorrect = answers.filter((a: { result: string | null }) => a.result === "CORRECT").length;
  const score = answers.length > 0 ? totalCorrect / answers.length : 0;

  // Complete session
  prisma.assessmentSession.update({
    where: { id: sessionId },
    data: {
      status: "COMPLETED",
      overallScore: score,
      severity: score >= 0.75 ? "GREEN" : score >= 0.5 ? "YELLOW" : "RED",
    },
  }).catch((err: unknown) => console.error("Session completion failed:", err));

  // Generate summary + vocal analysis + Telegram report in background
  generateSummaryInBackground(sessionId, profile.name, profile.language, profile.id, score);

  // Generate warm answer review with Gemini
  let reviewText: string;
  try {
    reviewText = await generateAnswerReview({
      elderlyName: profile.name,
      answers: answers.map((a: { questionText: string; correctAnswer: string; elderAnswer: string | null; result: string | null }) => ({
        questionText: a.questionText,
        correctAnswer: a.correctAnswer,
        elderAnswer: a.elderAnswer,
        result: a.result,
      })),
      language: profile.language,
    });
  } catch (err) {
    console.error("Answer review generation failed:", err);
    // Fallback to simple review
    const isArabic = profile.language === "ar";
    reviewText = isArabic
      ? `حصلت على ${totalCorrect} من ${answers.length} إجابات صحيحة. أحسنت! شكراً لوقتك اليوم. اعتني بنفسك!`
      : `You got ${totalCorrect} out of ${answers.length} correct. Great job! Thanks for your time today. Take care of yourself!`;
  }

  // Generate TTS for the review
  let reviewTag: string;
  try {
    const buf = await textToSpeech(reviewText, voiceId);
    const fileName = `assessment-review-${sessionId}.mp3`;
    await writeFile(path.join(audioDir, fileName), buf);
    reviewTag = `<Play>${baseUrl}/api/audio/${fileName}</Play>`;
  } catch {
    reviewTag = `<Say>${reviewText}</Say>`;
  }

  return new NextResponse(`<Response>${reviewTag}</Response>`, {
    headers: { "Content-Type": "text/xml" },
  });
}
```

**Step 2: Commit**

```bash
git add src/app/api/webhooks/assessment/next/route.ts
git commit -m "feat: add review phase with warm Gemini-generated answer walkthrough"
```

---

### Task 6: Update greeting and question prompts to be warmer/more energetic

**Files:**
- Modify: `src/lib/gemini.ts`

**Step 1: Update `generateAssessmentGreeting` prompt**

Replace the prompt string in `generateAssessmentGreeting` (around line 32-36) with:

```typescript
  const prompt = `You are a cheerful, energetic, warm assistant calling an elderly person named ${context.elderlyName}.
Generate a short, upbeat greeting for a daily cognitive check-in call in ${context.language === "ar" ? "Arabic" : "English"}.
Time of day: ${context.timeOfDay}.
Be enthusiastic! Mention you'd like to have a quick chat and ask a few fun questions together.
Keep it under 3 sentences. Sound like a friendly neighbor, not a nurse or doctor. Be warm, positive, and energetic!`;
```

**Step 2: Update `generateAssessmentQuestionAudio` prompt**

Replace the prompt string in `generateAssessmentQuestionAudio` (around line 51-55) with:

```typescript
  const prompt = `You are having a fun, warm phone conversation with ${context.elderlyName}.
Ask them this question naturally in ${context.language === "ar" ? "Arabic" : "English"}: "${context.questionText}"
This is question ${context.questionNumber} of ${context.totalQuestions}.
${context.questionNumber > 1 ? "Add a brief encouraging transition like 'You're doing great! Next one...' or 'Awesome, here's another one...'" : "Start with something warm like 'Alright, here's the first one!' or 'Let's start with an easy one!'"}
Keep it to 1-2 sentences max. Be energetic, positive, and conversational — like a fun game, not a test!`;
```

**Step 3: Commit**

```bash
git add src/lib/gemini.ts
git commit -m "feat: make greeting and question prompts warmer and more energetic"
```

---

### Task 7: Final integration test and push

**Step 1: Run TypeScript type check**

```bash
cd /Users/sonra/Desktop/Seniora/Seniora-AI && npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors

**Step 2: Verify the full flow is coherent**

Read through all modified files to verify:
- `gemini.ts` has `evaluateEmotionalResponse` and `generateAnswerReview`
- `assessment-call.ts` pre-generates emergency-ask audio
- `next/route.ts` has phases: cognitive → emotional → emergency-ask → review
- Imports are correct (no missing imports)

**Step 3: Commit any remaining fixes**

```bash
git add -A
git commit -m "fix: integration fixes for warm assessment flow"
```

**Step 4: Push**

```bash
git push
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/lib/gemini.ts` | Add `evaluateEmotionalResponse()`, `generateAnswerReview()`, update greeting/question prompts to be warmer |
| `src/lib/assessment-call.ts` | Pre-generate emergency-ask audio, update emotional question text |
| `src/app/api/webhooks/assessment/next/route.ts` | Restructure into 4 phases: cognitive → emotional (sentiment eval) → emergency-ask → review |

## New Call Phases

| Phase | Trigger | Action |
|-------|---------|--------|
| (none) | Each question Record callback | Save recording, bg evaluate, play next question |
| `emotional` | After last question | Gemini evaluates sentiment. POSITIVE → review. NEGATIVE → Telegram alert + emergency-ask |
| `emergency-ask` | After negative emotional | Parse yes/no. YES → call emergency contact. Both → move to review |
| `review` | After emotional/emergency | Gemini generates warm answer walkthrough. Complete session. Bg summary + Telegram report |
