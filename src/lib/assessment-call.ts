import { prisma } from "./prisma";
import { twilioClient } from "./twilio";
import { textToSpeech } from "./elevenlabs";
import { generateAssessmentGreeting, generateAssessmentQuestionAudio } from "./gemini";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

function escapeXml(str: string) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Try TTS, return Play tag on success or Say tag on failure
async function generateAudioTag(
  text: string,
  fileName: string,
  audioDir: string,
  baseUrl: string,
  voiceId?: string
): Promise<string> {
  try {
    const buf = await textToSpeech(text, voiceId);
    await writeFile(path.join(audioDir, fileName), buf);
    return `<Play>${baseUrl}/api/audio/${fileName}</Play>`;
  } catch (err) {
    console.warn(`TTS failed for ${fileName}, using <Say> fallback:`, err);
    return `<Say>${escapeXml(text)}</Say>`;
  }
}

export async function executeAssessmentCall(sessionId: string) {
  const session = await prisma.assessmentSession.findUnique({
    where: { id: sessionId },
    include: {
      elderlyProfile: true,
      config: true,
      answers: { orderBy: { orderIndex: "asc" } },
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
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL!;
    const audioDir = path.join(process.cwd(), "public", "audio");
    await mkdir(audioDir, { recursive: true });

    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
    const isArabic = profile.language === "ar";

    // Generate greeting script (Gemini text generation — not TTS, so unlikely to rate-limit)
    const greetingScript = await generateAssessmentGreeting({
      elderlyName: profile.name,
      language: profile.language,
      timeOfDay,
    });

    // Pre-generate ALL audio in parallel — each one falls back to <Say> independently
    const greetingPromise = generateAudioTag(
      greetingScript, `assessment-greeting-${sessionId}.mp3`, audioDir, baseUrl, voiceId
    );

    const questionPromises = session.answers.map(async (answer: { id: string; questionText: string }, idx: number) => {
      let qScript = `Question ${idx + 1}: ${answer.questionText}`;
      try {
        qScript = await generateAssessmentQuestionAudio({
          elderlyName: profile.name,
          questionText: answer.questionText,
          questionNumber: idx + 1,
          totalQuestions: session.answers.length,
          language: profile.language,
        });
      } catch { /* use plain question text */ }
      return generateAudioTag(qScript, `assessment-q-${answer.id}.mp3`, audioDir, baseUrl, voiceId);
    });

    const emotionalQText = isArabic
      ? "أحسنت! الآن أخبرني، كيف حالك اليوم؟ كيف تشعر؟"
      : "Great job with those! Now tell me, how are you doing today? How are you feeling?";
    const didntHearText = isArabic
      ? "لم أسمع شيئاً. دعنا ننتقل."
      : "I didn't hear anything. Let's move on.";
    const didntHearShortText = isArabic
      ? "لم أسمع شيئاً."
      : "I didn't hear anything.";
    const emergencyAskText = isArabic
      ? "أنا آسف لسماع ذلك. هل تريد أن أتصل بشخص من عائلتك أو طبيبك الآن؟"
      : "I'm sorry to hear that. Would you like me to call someone from your family or your doctor right now?";

    const emotionalPromise = generateAudioTag(emotionalQText, `assessment-emotional-${sessionId}.mp3`, audioDir, baseUrl, voiceId);
    const didntHearPromise = generateAudioTag(didntHearText, `assessment-noanswer-${sessionId}.mp3`, audioDir, baseUrl, voiceId);
    const didntHearShortPromise = generateAudioTag(didntHearShortText, `assessment-noanswer-short-${sessionId}.mp3`, audioDir, baseUrl, voiceId);
    const emergencyAskPromise = generateAudioTag(emergencyAskText, `assessment-emergency-ask-${sessionId}.mp3`, audioDir, baseUrl, voiceId);

    const [greetingTag, questionTags, , , ,] = await Promise.all([
      greetingPromise,
      Promise.all(questionPromises),
      emotionalPromise,
      didntHearPromise,
      didntHearShortPromise,
      emergencyAskPromise,
    ]);

    const q1Tag = questionTags[0];
    const didntHearTag = await didntHearPromise;

    const twiml = `<Response>
      ${greetingTag}
      <Pause length="1"/>
      ${q1Tag}
      <Record maxLength="15" playBeep="false" timeout="3" action="${baseUrl}/api/webhooks/assessment/next?sessionId=${sessionId}&amp;answerIndex=0" method="POST"/>
      ${didntHearTag}
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
