import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { textToSpeech } from "@/lib/elevenlabs";
import {
  evaluateAssessmentAnswer,
  generateAssessmentQuestionAudio,
  generateAssessmentClosing,
  generateAssessmentSummary,
} from "@/lib/gemini";
import { writeFile, mkdir, access } from "fs/promises";
import path from "path";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchRecordingWithRetry(recordingUrl: string, maxRetries = 3): Promise<Buffer | null> {
  const authHeader = `Basic ${Buffer.from(
    `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
  ).toString("base64")}`;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) await sleep(1000);

    // Try .mp3 format first, then raw URL
    for (const url of [`${recordingUrl}.mp3`, recordingUrl]) {
      try {
        const response = await fetch(url, {
          headers: { Authorization: authHeader },
          redirect: "follow",
        });
        if (response.ok) {
          const buffer = Buffer.from(await response.arrayBuffer());
          if (buffer.length > 0) return buffer;
        }
      } catch {
        // Continue to next attempt
      }
    }
  }
  return null;
}

async function transcribeRecording(recordingUrl: string): Promise<string> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const audioBuffer = await fetchRecordingWithRetry(recordingUrl);
  if (!audioBuffer) return "";

  const base64Audio = audioBuffer.toString("base64");

  const result = await model.generateContent([
    { text: "Transcribe the following audio recording. Return ONLY the transcription text, nothing else. If you cannot understand the audio, return 'UNCLEAR'." },
    { inlineData: { mimeType: "audio/mpeg", data: base64Audio } },
  ]);

  return result.response.text().trim();
}

async function generateAudioOrFallback(
  text: string,
  voiceId: string | undefined,
  fileName: string,
  audioDir: string,
  baseUrl: string
): Promise<{ url: string; usedTts: boolean }> {
  try {
    const buffer = await textToSpeech(text, voiceId);
    await writeFile(path.join(audioDir, fileName), buffer);
    return { url: `${baseUrl}/api/audio/${fileName}`, usedTts: true };
  } catch (err) {
    console.error("TTS failed, will use Twilio Say fallback:", err);
    return { url: "", usedTts: false };
  }
}

function playOrSay(url: string, usedTts: boolean, fallbackText: string): string {
  return usedTts ? `<Play>${url}</Play>` : `<Say>${fallbackText}</Say>`;
}

export async function POST(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId") || "";
  const answerIndex = parseInt(req.nextUrl.searchParams.get("answerIndex") || "0");
  const recordingUrl = req.nextUrl.searchParams.get("recordingUrl") || "";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  try {
    const session = await prisma.assessmentSession.findUnique({
      where: { id: sessionId },
      include: {
        answers: { orderBy: { orderIndex: "asc" } },
        elderlyProfile: true,
      },
    });

    if (!session || !session.answers[answerIndex]) {
      return new NextResponse("<Response><Say>Goodbye.</Say></Response>", {
        headers: { "Content-Type": "text/xml" },
      });
    }

    const currentAnswer = session.answers[answerIndex];
    const profile = session.elderlyProfile;
    const voiceId = profile.voiceId || undefined;
    const audioDir = path.join(process.cwd(), "public", "audio");
    await mkdir(audioDir, { recursive: true });

    const nextIndex = answerIndex + 1;
    const isLastQuestion = nextIndex >= session.answers.length;

    // Check if next question audio is already pre-generated
    const nextAnswer = !isLastQuestion ? session.answers[nextIndex] : null;
    const pregenFileName = nextAnswer ? `assessment-q-${nextAnswer.id}.mp3` : null;
    const pregenPath = pregenFileName ? path.join(audioDir, pregenFileName) : null;
    let nextQPregenerated = false;
    if (pregenPath) {
      try {
        await access(pregenPath);
        nextQPregenerated = true;
      } catch {
        nextQPregenerated = false;
      }
    }

    // Transcribe recording
    let elderAnswer = "";
    if (recordingUrl) {
      try {
        elderAnswer = await transcribeRecording(recordingUrl);
        console.log(`Transcription result for answer ${answerIndex}: "${elderAnswer}"`);
      } catch (err) {
        console.error("Transcription failed:", err);
        elderAnswer = "";
      }
    }

    // Evaluate answer + generate response TTS in parallel where possible
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

    // Run DB update and response TTS in parallel
    const [, responseAudio] = await Promise.all([
      prisma.assessmentAnswer.update({
        where: { id: currentAnswer.id },
        data: { elderAnswer: elderAnswer || null, result },
      }),
      generateAudioOrFallback(
        responseText, voiceId,
        `assessment-resp-${currentAnswer.id}.mp3`, audioDir, baseUrl!
      ),
    ]);

    if (isLastQuestion) {
      const allAnswers = await prisma.assessmentAnswer.findMany({
        where: { sessionId },
        orderBy: { orderIndex: "asc" },
      });

      const totalCorrect = allAnswers.filter((a) => a.result === "CORRECT").length;
      const score = allAnswers.length > 0 ? totalCorrect / allAnswers.length : 0;

      let closingText = "Thank you for answering my questions today. Take care!";
      try {
        closingText = await generateAssessmentClosing({
          elderlyName: profile.name,
          score: totalCorrect,
          totalQuestions: allAnswers.length,
          language: profile.language,
        });
      } catch (err) {
        console.error("Closing generation failed:", err);
      }

      const closingAudio = await generateAudioOrFallback(
        closingText, voiceId,
        `assessment-closing-${sessionId}.mp3`, audioDir, baseUrl!
      );

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
        ${playOrSay(responseAudio.url, responseAudio.usedTts, responseText)}
        <Pause length="1"/>
        ${playOrSay(closingAudio.url, closingAudio.usedTts, closingText)}
      </Response>`;

      return new NextResponse(twiml, {
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Use pre-generated question audio if available, otherwise generate on-the-fly
    let nextQAudio: { url: string; usedTts: boolean };
    let nextQText = `Question ${nextIndex + 1}: ${nextAnswer!.questionText}`;

    if (nextQPregenerated) {
      nextQAudio = { url: `${baseUrl}/api/audio/${pregenFileName}`, usedTts: true };
    } else {
      try {
        nextQText = await generateAssessmentQuestionAudio({
          elderlyName: profile.name,
          questionText: nextAnswer!.questionText,
          questionNumber: nextIndex + 1,
          totalQuestions: session.answers.length,
          language: profile.language,
        });
      } catch (err) {
        console.error("Question audio generation failed:", err);
      }
      nextQAudio = await generateAudioOrFallback(
        nextQText, voiceId,
        `assessment-q-${nextAnswer!.id}.mp3`, audioDir, baseUrl!
      );
    }

    const fillerIndex = Math.floor(Math.random() * 5);
    const fillerVoice = (voiceId || "21m00Tcm4TlvDq8ikWAM").slice(0, 8);
    const nextFillerUrl = `${baseUrl}/api/audio/fillers/filler-${fillerVoice}-${fillerIndex}.mp3`;

    const twiml = `<Response>
      ${playOrSay(responseAudio.url, responseAudio.usedTts, responseText)}
      <Pause length="1"/>
      ${playOrSay(nextQAudio.url, nextQAudio.usedTts, nextQText)}
      <Record maxLength="15" playBeep="false" timeout="5" action="${baseUrl}/api/webhooks/assessment?sessionId=${sessionId}&amp;answerIndex=${nextIndex}&amp;fillerUrl=${encodeURIComponent(nextFillerUrl)}" method="POST"/>
      <Say>I didn't hear anything. Let's move on.</Say>
      <Redirect method="POST">${baseUrl}/api/webhooks/assessment/next?sessionId=${sessionId}&amp;answerIndex=${nextIndex}</Redirect>
    </Response>`;

    return new NextResponse(twiml, {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (err) {
    console.error("Assessment /next webhook error:", err);

    // Try to determine if this was the last question so we can complete the session
    try {
      const session = await prisma.assessmentSession.findUnique({
        where: { id: sessionId },
        include: { answers: { orderBy: { orderIndex: "asc" } } },
      });

      if (session) {
        const nextIndex = answerIndex + 1;
        const isLast = nextIndex >= session.answers.length;

        if (isLast) {
          // Complete the session with whatever data we have
          const allAnswers = session.answers;
          const totalCorrect = allAnswers.filter((a) => a.result === "CORRECT").length;
          const score = allAnswers.length > 0 ? totalCorrect / allAnswers.length : 0;

          await prisma.assessmentSession.update({
            where: { id: sessionId },
            data: {
              status: "COMPLETED",
              overallScore: score,
              severity: score >= 0.75 ? "GREEN" : score >= 0.5 ? "YELLOW" : "RED",
            },
          });

          const twiml = `<Response>
            <Say>Thank you for your time today. Goodbye!</Say>
          </Response>`;
          return new NextResponse(twiml, {
            headers: { "Content-Type": "text/xml" },
          });
        }

        // Not the last question — skip to next
        const twiml = `<Response>
          <Say>Let's move on to the next question.</Say>
          <Redirect method="POST">${baseUrl}/api/webhooks/assessment/next?sessionId=${sessionId}&amp;answerIndex=${nextIndex}</Redirect>
        </Response>`;
        return new NextResponse(twiml, {
          headers: { "Content-Type": "text/xml" },
        });
      }
    } catch (innerErr) {
      console.error("Error in assessment error handler:", innerErr);
    }

    // Fallback: end the call gracefully
    const twiml = `<Response>
      <Say>Thank you for your time today. Goodbye!</Say>
    </Response>`;
    return new NextResponse(twiml, {
      headers: { "Content-Type": "text/xml" },
    });
  }
}
