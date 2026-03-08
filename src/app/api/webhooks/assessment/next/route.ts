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

function buildGatherTwiml(
  baseUrl: string,
  sessionId: string,
  answerIndex: number,
  language: string
): string {
  const lang = language === "ar" ? "ar-SA" : "en-US";
  return `<Gather input="speech" speechTimeout="3" language="${lang}" action="${baseUrl}/api/webhooks/assessment?sessionId=${sessionId}&amp;answerIndex=${answerIndex}" method="POST">
      </Gather>
      <Say>I didn't hear anything. Let's move on.</Say>
      <Redirect method="POST">${baseUrl}/api/webhooks/assessment/next?sessionId=${sessionId}&amp;answerIndex=${answerIndex}&amp;speechResult=</Redirect>`;
}

// Fire-and-forget: generate summary after call ends
async function generateSummaryInBackground(
  sessionId: string,
  elderlyName: string,
  language: string
) {
  try {
    const allAnswers = await prisma.assessmentAnswer.findMany({
      where: { sessionId },
      orderBy: { orderIndex: "asc" },
    });

    const totalCorrect = allAnswers.filter((a) => a.result === "CORRECT").length;
    const score = allAnswers.length > 0 ? totalCorrect / allAnswers.length : 0;
    const todayStr = new Date().toLocaleDateString("en-CA");

    const report = await generateAssessmentSummary({
      elderlyName,
      date: todayStr,
      answers: allAnswers.map((a) => ({
        questionText: a.questionText,
        correctAnswer: a.correctAnswer,
        elderAnswer: a.elderAnswer,
        result: a.result || "UNCLEAR",
      })),
      language,
    });

    await prisma.assessmentSession.update({
      where: { id: sessionId },
      data: {
        summary: report.summary,
        severity: report.severity,
      },
    });
  } catch (err) {
    console.error("Background summary generation failed:", err);
  }
}

export async function POST(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId") || "";
  const answerIndex = parseInt(req.nextUrl.searchParams.get("answerIndex") || "0");
  const elderAnswer = decodeURIComponent(req.nextUrl.searchParams.get("speechResult") || "");
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

    // Evaluate answer (only Gemini call needed now — no transcription!)
    let result: "CORRECT" | "WRONG" | "UNCLEAR" = "UNCLEAR";
    let responseText = "I didn't quite catch that, but that's okay. Let's continue.";

    if (elderAnswer && elderAnswer.trim()) {
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
      // Calculate score and complete session immediately
      const allAnswers = await prisma.assessmentAnswer.findMany({
        where: { sessionId },
        orderBy: { orderIndex: "asc" },
      });

      const totalCorrect = allAnswers.filter((a) => a.result === "CORRECT").length;
      const score = allAnswers.length > 0 ? totalCorrect / allAnswers.length : 0;

      // Generate closing + update session in parallel
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

      const [closingAudio] = await Promise.all([
        generateAudioOrFallback(
          closingText, voiceId,
          `assessment-closing-${sessionId}.mp3`, audioDir, baseUrl!
        ),
        prisma.assessmentSession.update({
          where: { id: sessionId },
          data: {
            status: "COMPLETED",
            overallScore: score,
            severity: score >= 0.75 ? "GREEN" : score >= 0.5 ? "YELLOW" : "RED",
          },
        }),
      ]);

      // Generate detailed summary in background — don't block the call
      generateSummaryInBackground(sessionId, profile.name, profile.language);

      const twiml = `<Response>
        ${playOrSay(responseAudio.url, responseAudio.usedTts, responseText)}
        <Pause length="1"/>
        ${playOrSay(closingAudio.url, closingAudio.usedTts, closingText)}
      </Response>`;

      return new NextResponse(twiml, {
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Check if next question audio is already pre-generated
    const nextAnswer = session.answers[nextIndex];
    const pregenFileName = `assessment-q-${nextAnswer.id}.mp3`;
    const pregenPath = path.join(audioDir, pregenFileName);
    let nextQPregenerated = false;
    try {
      await access(pregenPath);
      nextQPregenerated = true;
    } catch {
      nextQPregenerated = false;
    }

    let nextQAudio: { url: string; usedTts: boolean };
    let nextQText = `Question ${nextIndex + 1}: ${nextAnswer.questionText}`;

    if (nextQPregenerated) {
      nextQAudio = { url: `${baseUrl}/api/audio/${pregenFileName}`, usedTts: true };
    } else {
      try {
        nextQText = await generateAssessmentQuestionAudio({
          elderlyName: profile.name,
          questionText: nextAnswer.questionText,
          questionNumber: nextIndex + 1,
          totalQuestions: session.answers.length,
          language: profile.language,
        });
      } catch (err) {
        console.error("Question audio generation failed:", err);
      }
      nextQAudio = await generateAudioOrFallback(
        nextQText, voiceId,
        `assessment-q-${nextAnswer.id}.mp3`, audioDir, baseUrl!
      );
    }

    const twiml = `<Response>
      ${playOrSay(responseAudio.url, responseAudio.usedTts, responseText)}
      <Pause length="1"/>
      ${playOrSay(nextQAudio.url, nextQAudio.usedTts, nextQText)}
      ${buildGatherTwiml(baseUrl!, sessionId, nextIndex, profile.language)}
    </Response>`;

    return new NextResponse(twiml, {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (err) {
    console.error("Assessment /next webhook error:", err);

    try {
      const session = await prisma.assessmentSession.findUnique({
        where: { id: sessionId },
        include: { answers: { orderBy: { orderIndex: "asc" } } },
      });

      if (session) {
        const nextIndex = answerIndex + 1;
        const isLast = nextIndex >= session.answers.length;

        if (isLast) {
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

          return new NextResponse(
            `<Response><Say>Thank you for your time today. Goodbye!</Say></Response>`,
            { headers: { "Content-Type": "text/xml" } }
          );
        }

        const twiml = `<Response>
          <Say>Let's move on to the next question.</Say>
          <Redirect method="POST">${baseUrl}/api/webhooks/assessment/next?sessionId=${sessionId}&amp;answerIndex=${nextIndex}&amp;speechResult=</Redirect>
        </Response>`;
        return new NextResponse(twiml, {
          headers: { "Content-Type": "text/xml" },
        });
      }
    } catch (innerErr) {
      console.error("Error in assessment error handler:", innerErr);
    }

    return new NextResponse(
      `<Response><Say>Thank you for your time today. Goodbye!</Say></Response>`,
      { headers: { "Content-Type": "text/xml" } }
    );
  }
}
