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

  let elderAnswer = "";
  if (recordingUrl) {
    try {
      elderAnswer = await transcribeRecording(recordingUrl);
    } catch (err) {
      console.error("Transcription failed:", err);
      elderAnswer = "";
    }
  }

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

  await prisma.assessmentAnswer.update({
    where: { id: currentAnswer.id },
    data: { elderAnswer: elderAnswer || null, result },
  });

  const responseBuffer = await textToSpeech(responseText, voiceId);
  const responseFileName = `assessment-resp-${currentAnswer.id}.mp3`;
  await writeFile(path.join(audioDir, responseFileName), responseBuffer);
  const responseUrl = `${baseUrl}/api/audio/${responseFileName}`;

  const nextIndex = answerIndex + 1;
  const isLastQuestion = nextIndex >= session.answers.length;

  if (isLastQuestion) {
    const allAnswers = await prisma.assessmentAnswer.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
    });

    const totalCorrect = allAnswers.filter((a) => a.result === "CORRECT").length;
    const score = allAnswers.length > 0 ? totalCorrect / allAnswers.length : 0;

    const closingScript = await generateAssessmentClosing({
      elderlyName: profile.name,
      score: totalCorrect,
      totalQuestions: allAnswers.length,
      language: profile.language,
    });

    const closingBuffer = await textToSpeech(closingScript, voiceId);
    const closingFileName = `assessment-closing-${sessionId}.mp3`;
    await writeFile(path.join(audioDir, closingFileName), closingBuffer);
    const closingUrl = `${baseUrl}/api/audio/${closingFileName}`;

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
