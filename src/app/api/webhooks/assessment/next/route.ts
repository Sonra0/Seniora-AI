import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  evaluateAssessmentAnswer,
  generateAssessmentQuestionAudio,
  generateAssessmentClosing,
  generateAssessmentSummary,
} from "@/lib/gemini";
import { textToSpeech } from "@/lib/elevenlabs";
import { writeFile, mkdir, access } from "fs/promises";
import path from "path";

function buildGatherTwiml(
  baseUrl: string,
  sessionId: string,
  answerIndex: number,
  language: string
): string {
  const lang = language === "ar" ? "ar-SA" : "en-US";
  return `<Gather input="speech" speechTimeout="3" language="${lang}" action="${baseUrl}/api/webhooks/assessment/next?sessionId=${sessionId}&amp;answerIndex=${answerIndex}" method="POST">
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

    const totalCorrect = allAnswers.filter((a: { result: string | null }) => a.result === "CORRECT").length;
    const score = allAnswers.length > 0 ? totalCorrect / allAnswers.length : 0;
    const todayStr = new Date().toLocaleDateString("en-CA");

    const report = await generateAssessmentSummary({
      elderlyName,
      date: todayStr,
      answers: allAnswers.map((a: { questionText: string; correctAnswer: string; elderAnswer: string | null; result: string | null }) => ({
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
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  // Get speech result from either form data (Gather callback) or query param (redirect fallback)
  let elderAnswer = "";
  try {
    const formData = await req.formData();
    elderAnswer = (formData.get("SpeechResult") as string) || "";
  } catch {
    elderAnswer = decodeURIComponent(req.nextUrl.searchParams.get("speechResult") || "");
  }

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

    const nextIndex = answerIndex + 1;
    const isLastQuestion = nextIndex >= session.answers.length;

    // Evaluate answer — the only blocking API call now
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

    // DB update — fire and forget, don't wait
    prisma.assessmentAnswer.update({
      where: { id: currentAnswer.id },
      data: { elderAnswer: elderAnswer || null, result },
    }).catch((err: unknown) => console.error("DB update failed:", err));

    if (isLastQuestion) {
      // Complete session in background
      const completionPromise = (async () => {
        const allAnswers = await prisma.assessmentAnswer.findMany({
          where: { sessionId },
          orderBy: { orderIndex: "asc" },
        });
        const totalCorrect = allAnswers.filter((a: { result: string | null }) => a.result === "CORRECT").length;
        const score = allAnswers.length > 0 ? totalCorrect / allAnswers.length : 0;

        await prisma.assessmentSession.update({
          where: { id: sessionId },
          data: {
            status: "COMPLETED",
            overallScore: score,
            severity: score >= 0.75 ? "GREEN" : score >= 0.5 ? "YELLOW" : "RED",
          },
        });

        // Summary in background too
        generateSummaryInBackground(sessionId, profile.name, profile.language);
      })();
      completionPromise.catch(err => console.error("Session completion failed:", err));

      // Use <Say> for closing — instant, no TTS API call
      const closingText = profile.language === "ar"
        ? "شكراً لإجاباتك اليوم. اعتني بنفسك!"
        : "Thank you for answering my questions today. Take care!";

      const twiml = `<Response>
        <Say>${responseText}</Say>
        <Pause length="1"/>
        <Say>${closingText}</Say>
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

    let nextQAudioTag: string;

    if (nextQPregenerated) {
      nextQAudioTag = `<Play>${baseUrl}/api/audio/${pregenFileName}</Play>`;
    } else {
      // Fallback: generate on-the-fly
      let nextQText = `Question ${nextIndex + 1}: ${nextAnswer.questionText}`;
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

      try {
        await mkdir(audioDir, { recursive: true });
        const buffer = await textToSpeech(nextQText, voiceId);
        await writeFile(path.join(audioDir, pregenFileName), buffer);
        nextQAudioTag = `<Play>${baseUrl}/api/audio/${pregenFileName}</Play>`;
      } catch {
        nextQAudioTag = `<Say>${nextQText}</Say>`;
      }
    }

    // Use <Say> for response — instant, no TTS needed for short phrases
    const twiml = `<Response>
      <Say>${responseText}</Say>
      <Pause length="1"/>
      ${nextQAudioTag}
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
          const totalCorrect = allAnswers.filter((a: { result: string | null }) => a.result === "CORRECT").length;
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
