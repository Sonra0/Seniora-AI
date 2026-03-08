import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  evaluateAssessmentAnswer,
  generateAssessmentQuestionAudio,
  generateAssessmentSummary,
} from "@/lib/gemini";
import { textToSpeech } from "@/lib/elevenlabs";
import { writeFile, mkdir, access } from "fs/promises";
import path from "path";

function buildGatherTwiml(
  baseUrl: string,
  sessionId: string,
  answerIndex: number,
  language: string,
  phase?: string
): string {
  const lang = language === "ar" ? "ar-SA" : "en-US";
  const phaseParam = phase ? `&amp;phase=${phase}` : "";
  return `<Gather input="speech" speechTimeout="3" language="${lang}" action="${baseUrl}/api/webhooks/assessment/next?sessionId=${sessionId}&amp;answerIndex=${answerIndex}${phaseParam}" method="POST">
      </Gather>
      <Say>I didn't hear anything. Let's move on.</Say>
      <Redirect method="POST">${baseUrl}/api/webhooks/assessment/next?sessionId=${sessionId}&amp;answerIndex=${answerIndex}${phaseParam}&amp;speechResult=</Redirect>`;
}

// Fire-and-forget: evaluate a single answer via Gemini and save to DB
function evaluateInBackground(
  answerId: string,
  questionText: string,
  correctAnswer: string,
  elderAnswer: string,
  language: string
) {
  evaluateAssessmentAnswer({ questionText, correctAnswer, elderAnswer, language })
    .then(async (evaluation) => {
      await prisma.assessmentAnswer.update({
        where: { id: answerId },
        data: { result: evaluation.result },
      });
    })
    .catch((err: unknown) => console.error("Background evaluation failed:", err));
}

// Fire-and-forget: generate summary
function generateSummaryInBackground(
  sessionId: string,
  elderlyName: string,
  language: string
) {
  (async () => {
    try {
      const allAnswers = await prisma.assessmentAnswer.findMany({
        where: { sessionId },
        orderBy: { orderIndex: "asc" },
      });
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
        data: { summary: report.summary, severity: report.severity },
      });
    } catch (err) {
      console.error("Background summary failed:", err);
    }
  })();
}

function getSpeechResult(req: NextRequest, formData: FormData | null): string {
  if (formData) {
    const speech = formData.get("SpeechResult") as string;
    if (speech) return speech;
  }
  return decodeURIComponent(req.nextUrl.searchParams.get("speechResult") || "");
}

export async function POST(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId") || "";
  const answerIndex = parseInt(req.nextUrl.searchParams.get("answerIndex") || "0");
  const phase = req.nextUrl.searchParams.get("phase") || "";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  let formData: FormData | null = null;
  try {
    formData = await req.formData();
  } catch {
    // No form data (redirect fallback)
  }
  const elderAnswer = getSpeechResult(req, formData);

  try {
    const session = await prisma.assessmentSession.findUnique({
      where: { id: sessionId },
      include: {
        answers: { orderBy: { orderIndex: "asc" } },
        elderlyProfile: true,
      },
    });

    if (!session) {
      return new NextResponse("<Response><Say>Goodbye.</Say></Response>", {
        headers: { "Content-Type": "text/xml" },
      });
    }

    const profile = session.elderlyProfile;
    const audioDir = path.join(process.cwd(), "public", "audio");
    const totalQuestions = session.answers.length;

    // ============================================================
    // PHASE: EMOTIONAL — user just answered the emotional question
    // ============================================================
    if (phase === "emotional") {
      // Save emotional response
      prisma.assessmentSession.update({
        where: { id: sessionId },
        data: { emotionalResponse: elderAnswer || null },
      }).catch((err: unknown) => console.error("Emotional save failed:", err));

      // Read evaluation results from DB (should be done by now)
      const answers = await prisma.assessmentAnswer.findMany({
        where: { sessionId },
        orderBy: { orderIndex: "asc" },
      });

      const totalCorrect = answers.filter((a: { result: string | null }) => a.result === "CORRECT").length;
      const score = answers.length > 0 ? totalCorrect / answers.length : 0;

      // Build spoken summary
      const isArabic = profile.language === "ar";
      let summaryParts: string[] = [];

      if (isArabic) {
        summaryParts.push(`حصلت على ${totalCorrect} من ${answers.length} إجابات صحيحة.`);
      } else {
        summaryParts.push(`You got ${totalCorrect} out of ${answers.length} correct.`);
      }

      for (const a of answers) {
        if (a.result === "CORRECT") {
          if (isArabic) {
            summaryParts.push(`سؤال: ${a.questionText}. إجابتك صحيحة!`);
          } else {
            summaryParts.push(`For the question: ${a.questionText}. You answered correctly!`);
          }
        } else if (a.result === "WRONG") {
          if (isArabic) {
            summaryParts.push(`سؤال: ${a.questionText}. الإجابة الصحيحة هي ${a.correctAnswer}.`);
          } else {
            summaryParts.push(`For the question: ${a.questionText}. The correct answer is ${a.correctAnswer}.`);
          }
        } else {
          if (isArabic) {
            summaryParts.push(`سؤال: ${a.questionText}. لم أتمكن من سماع إجابتك. الإجابة هي ${a.correctAnswer}.`);
          } else {
            summaryParts.push(`For the question: ${a.questionText}. I couldn't catch your answer. The answer is ${a.correctAnswer}.`);
          }
        }
      }

      const closingText = isArabic
        ? "شكراً لوقتك اليوم. اعتني بنفسك!"
        : "Thank you for your time today. Take care!";
      summaryParts.push(closingText);

      // Complete session
      prisma.assessmentSession.update({
        where: { id: sessionId },
        data: {
          status: "COMPLETED",
          overallScore: score,
          severity: score >= 0.75 ? "GREEN" : score >= 0.5 ? "YELLOW" : "RED",
        },
      }).catch((err: unknown) => console.error("Session completion failed:", err));

      // Generate detailed summary in background
      generateSummaryInBackground(sessionId, profile.name, profile.language);

      const twiml = `<Response>
        ${summaryParts.map(s => `<Say>${s}</Say>`).join("\n        <Pause length=\"1\"/>\n        ")}
      </Response>`;

      return new NextResponse(twiml, {
        headers: { "Content-Type": "text/xml" },
      });
    }

    // ============================================================
    // PHASE: COGNITIVE QUESTIONS — save answer, evaluate in bg, next question
    // ============================================================
    const currentAnswer = session.answers[answerIndex];
    if (!currentAnswer) {
      return new NextResponse("<Response><Say>Goodbye.</Say></Response>", {
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Save answer to DB (fire-and-forget)
    prisma.assessmentAnswer.update({
      where: { id: currentAnswer.id },
      data: { elderAnswer: elderAnswer || null },
    }).catch((err: unknown) => console.error("Answer save failed:", err));

    // Start background Gemini evaluation (fire-and-forget)
    if (elderAnswer && elderAnswer.trim()) {
      evaluateInBackground(
        currentAnswer.id,
        currentAnswer.questionText,
        currentAnswer.correctAnswer,
        elderAnswer,
        profile.language
      );
    } else {
      // No answer — mark as UNCLEAR
      prisma.assessmentAnswer.update({
        where: { id: currentAnswer.id },
        data: { result: "UNCLEAR" },
      }).catch((err: unknown) => console.error("UNCLEAR update failed:", err));
    }

    const nextIndex = answerIndex + 1;
    const isLastCognitive = nextIndex >= totalQuestions;

    if (isLastCognitive) {
      // All cognitive questions done — ask the emotional question
      const isArabic = profile.language === "ar";
      const emotionalQ = isArabic
        ? "شكراً على إجاباتك. الآن، كيف تشعر اليوم؟ هل هناك شيء يزعجك أو يقلقك؟"
        : "Thanks for answering those questions. Now, how are you feeling today? Is there anything bothering you or on your mind?";

      const twiml = `<Response>
        <Pause length="1"/>
        <Say>${emotionalQ}</Say>
        ${buildGatherTwiml(baseUrl!, sessionId, answerIndex, profile.language, "emotional")}
      </Response>`;

      return new NextResponse(twiml, {
        headers: { "Content-Type": "text/xml" },
      });
    }

    // More cognitive questions — play next one immediately (no validation delay)
    const nextAnswer = session.answers[nextIndex];
    const pregenFileName = `assessment-q-${nextAnswer.id}.mp3`;
    const pregenPath = path.join(audioDir, pregenFileName);
    let nextQAudioTag: string;

    try {
      await access(pregenPath);
      nextQAudioTag = `<Play>${baseUrl}/api/audio/${pregenFileName}</Play>`;
    } catch {
      // Fallback: generate on-the-fly
      let nextQText = `Question ${nextIndex + 1}: ${nextAnswer.questionText}`;
      try {
        nextQText = await generateAssessmentQuestionAudio({
          elderlyName: profile.name,
          questionText: nextAnswer.questionText,
          questionNumber: nextIndex + 1,
          totalQuestions: totalQuestions,
          language: profile.language,
        });
      } catch (err) {
        console.error("Question audio generation failed:", err);
      }
      try {
        await mkdir(audioDir, { recursive: true });
        const voiceId = profile.voiceId || undefined;
        const buffer = await textToSpeech(nextQText, voiceId);
        await writeFile(path.join(audioDir, pregenFileName), buffer);
        nextQAudioTag = `<Play>${baseUrl}/api/audio/${pregenFileName}</Play>`;
      } catch {
        nextQAudioTag = `<Say>${nextQText}</Say>`;
      }
    }

    const twiml = `<Response>
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
        if (nextIndex >= session.answers.length) {
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
          <Say>Let's move on.</Say>
          <Redirect method="POST">${baseUrl}/api/webhooks/assessment/next?sessionId=${sessionId}&amp;answerIndex=${nextIndex}&amp;speechResult=</Redirect>
        </Response>`;
        return new NextResponse(twiml, { headers: { "Content-Type": "text/xml" } });
      }
    } catch (innerErr) {
      console.error("Error in error handler:", innerErr);
    }

    return new NextResponse(
      `<Response><Say>Thank you for your time today. Goodbye!</Say></Response>`,
      { headers: { "Content-Type": "text/xml" } }
    );
  }
}
