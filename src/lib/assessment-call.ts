import { prisma } from "./prisma";
import { twilioClient } from "./twilio";
import { textToSpeech } from "./elevenlabs";
import { generateAssessmentGreeting, generateAssessmentQuestionAudio } from "./gemini";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

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

    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

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

    // Pre-generate ALL question audio in parallel (eliminates per-question latency during call)
    const questionAudioPromises = session.answers.map(async (answer: { id: string; questionText: string }, idx: number) => {
      const qScript = await generateAssessmentQuestionAudio({
        elderlyName: profile.name,
        questionText: answer.questionText,
        questionNumber: idx + 1,
        totalQuestions: session.answers.length,
        language: profile.language,
      });
      const qBuffer = await textToSpeech(qScript, voiceId);
      const qFileName = `assessment-q-${answer.id}.mp3`;
      await writeFile(path.join(audioDir, qFileName), qBuffer);
      return `${process.env.NEXT_PUBLIC_APP_URL}/api/audio/${qFileName}`;
    });

    // Pre-generate emotional question, "didn't hear" fallback, and "goodbye" audio in parallel with questions
    const isArabic = profile.language === "ar";
    const emotionalQText = isArabic
      ? "أحسنت! الآن أخبرني، كيف حالك اليوم؟ كيف تشعر؟"
      : "Great job with those! Now tell me, how are you doing today? How are you feeling?";
    const didntHearText = isArabic
      ? "لم أسمع شيئاً. دعنا ننتقل."
      : "I didn't hear anything. Let's move on.";
    const didntHearShortText = isArabic
      ? "لم أسمع شيئاً."
      : "I didn't hear anything.";

    const emotionalAudioPromise = (async () => {
      const buf = await textToSpeech(emotionalQText, voiceId);
      const fileName = `assessment-emotional-${sessionId}.mp3`;
      await writeFile(path.join(audioDir, fileName), buf);
      return fileName;
    })();
    const didntHearAudioPromise = (async () => {
      const buf = await textToSpeech(didntHearText, voiceId);
      const fileName = `assessment-noanswer-${sessionId}.mp3`;
      await writeFile(path.join(audioDir, fileName), buf);
      return fileName;
    })();
    const didntHearShortAudioPromise = (async () => {
      const buf = await textToSpeech(didntHearShortText, voiceId);
      const fileName = `assessment-noanswer-short-${sessionId}.mp3`;
      await writeFile(path.join(audioDir, fileName), buf);
      return fileName;
    })();
    const emergencyAskAudioPromise = (async () => {
      const emergencyAskText = isArabic
        ? "أنا آسف لسماع ذلك. هل تريد أن أتصل بشخص من عائلتك أو طبيبك الآن؟"
        : "I'm sorry to hear that. Would you like me to call someone from your family or your doctor right now?";
      const buf = await textToSpeech(emergencyAskText, voiceId);
      const fileName = `assessment-emergency-ask-${sessionId}.mp3`;
      await writeFile(path.join(audioDir, fileName), buf);
      return fileName;
    })();

    const [questionUrls, emotionalFileName, didntHearFileName, didntHearShortFileName, emergencyAskFileName] = await Promise.all([
      Promise.all(questionAudioPromises),
      emotionalAudioPromise,
      didntHearAudioPromise,
      didntHearShortAudioPromise,
      emergencyAskAudioPromise,
    ]);
    const q1Url = questionUrls[0];

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
    const didntHearUrl = `${baseUrl}/api/audio/${didntHearFileName}`;

    const twiml = `<Response>
      <Play>${greetingUrl}</Play>
      <Pause length="1"/>
      <Play>${q1Url}</Play>
      <Record maxLength="15" playBeep="false" timeout="3" action="${baseUrl}/api/webhooks/assessment/next?sessionId=${sessionId}&amp;answerIndex=0" method="POST"/>
      <Play>${didntHearUrl}</Play>
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
