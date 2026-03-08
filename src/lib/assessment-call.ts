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

    const fillerUrls = await ensureFillerAudio(voiceId || "21m00Tcm4TlvDq8ikWAM");

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
