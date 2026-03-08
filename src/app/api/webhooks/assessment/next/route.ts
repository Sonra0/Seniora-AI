import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  evaluateAssessmentAnswer,
  generateAssessmentQuestionAudio,
  generateAssessmentSummary,
  analyzeVocalBiomarkers,
} from "@/lib/gemini";
import { textToSpeech } from "@/lib/elevenlabs";
import { sendTelegramNotification } from "@/lib/telegram-api";
import { writeFile, mkdir, access } from "fs/promises";
import path from "path";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fetch recording from Twilio, transcribe with Gemini, evaluate, save to DB
function processAnswerInBackground(
  answerId: string,
  recordingUrl: string,
  questionText: string,
  correctAnswer: string,
  language: string
) {
  (async () => {
    try {
      const authHeader = `Basic ${Buffer.from(
        `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
      ).toString("base64")}`;

      // Wait a moment for Twilio to process the recording
      await sleep(1500);

      let audioBuffer: Buffer | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await sleep(1000);
        for (const url of [`${recordingUrl}.mp3`, recordingUrl]) {
          try {
            const response = await fetch(url, {
              headers: { Authorization: authHeader },
              redirect: "follow",
            });
            if (response.ok) {
              const buf = Buffer.from(await response.arrayBuffer());
              if (buf.length > 0) { audioBuffer = buf; break; }
            }
          } catch { /* retry */ }
        }
        if (audioBuffer) break;
      }

      if (!audioBuffer) {
        await prisma.assessmentAnswer.update({
          where: { id: answerId },
          data: { result: "UNCLEAR" },
        });
        return;
      }

      // Transcribe
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const base64Audio = audioBuffer.toString("base64");
      const transcription = await model.generateContent([
        { text: "Transcribe the following audio recording. Return ONLY the transcription text, nothing else. If you cannot understand the audio, return 'UNCLEAR'." },
        { inlineData: { mimeType: "audio/mpeg", data: base64Audio } },
      ]);
      const elderAnswer = transcription.response.text().trim();

      if (!elderAnswer || elderAnswer === "UNCLEAR") {
        await prisma.assessmentAnswer.update({
          where: { id: answerId },
          data: { elderAnswer: elderAnswer || null, result: "UNCLEAR" },
        });
        return;
      }

      // Evaluate
      const evaluation = await evaluateAssessmentAnswer({
        questionText, correctAnswer, elderAnswer, language,
      });

      await prisma.assessmentAnswer.update({
        where: { id: answerId },
        data: { elderAnswer, result: evaluation.result },
      });
    } catch (err) {
      console.error("Background answer processing failed:", err);
      await prisma.assessmentAnswer.update({
        where: { id: answerId },
        data: { result: "UNCLEAR" },
      }).catch(() => {});
    }
  })();
}

function generateSummaryInBackground(
  sessionId: string,
  elderlyName: string,
  language: string,
  elderlyProfileId: string,
  overallScore: number
) {
  (async () => {
    try {
      const allAnswers = await prisma.assessmentAnswer.findMany({
        where: { sessionId },
        orderBy: { orderIndex: "asc" },
      });
      const todayStr = new Date().toLocaleDateString("en-CA");

      // Generate text summary and vocal analysis in parallel
      const summaryPromise = generateAssessmentSummary({
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

      // Fetch all recordings for vocal analysis
      const vocalPromise = (async () => {
        const authHeader = `Basic ${Buffer.from(
          `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
        ).toString("base64")}`;

        const audioBuffers: Buffer[] = [];
        for (const a of allAnswers) {
          const recUrl = (a as { recordingUrl: string | null }).recordingUrl;
          if (!recUrl) continue;
          try {
            const res = await fetch(recUrl, {
              headers: { Authorization: authHeader },
              redirect: "follow",
            });
            if (res.ok) {
              const buf = Buffer.from(await res.arrayBuffer());
              if (buf.length > 0) audioBuffers.push(buf);
            }
          } catch { /* skip */ }
        }

        if (audioBuffers.length === 0) return null;
        return analyzeVocalBiomarkers(audioBuffers, elderlyName);
      })();

      const [report, vocalAnalysis] = await Promise.all([summaryPromise, vocalPromise]);

      const severity = report.severity;

      await prisma.assessmentSession.update({
        where: { id: sessionId },
        data: {
          summary: report.summary,
          severity,
          ...(vocalAnalysis ? { vocalAnalysis: vocalAnalysis as object } : {}),
        },
      });

      // Send detailed assessment report via Telegram
      try {
        const scorePct = Math.round(overallScore * 100);
        const severityIcon = severity === "GREEN" ? "\u2705" : severity === "YELLOW" ? "\u26A0\uFE0F" : "\u274C";
        const totalCorrect = allAnswers.filter((a: { result: string | null }) => a.result === "CORRECT").length;
        const totalWrong = allAnswers.filter((a: { result: string | null }) => a.result === "WRONG").length;
        const totalUnclear = allAnswers.filter((a: { result: string | null }) => a.result !== "CORRECT" && a.result !== "WRONG").length;

        let msg = `${severityIcon} *${elderlyName}'s Assessment Report*\n`;
        msg += `${todayStr}\n\n`;
        msg += `*Score:* ${scorePct}% (${totalCorrect}/${allAnswers.length} correct)\n`;
        msg += `*Status:* ${severity}\n\n`;

        if (report.summary) {
          msg += `*Summary:* ${report.summary}\n\n`;
        }

        // Question-by-question breakdown
        msg += `*Questions:*\n`;
        for (let i = 0; i < allAnswers.length; i++) {
          const a = allAnswers[i];
          const icon = a.result === "CORRECT" ? "\u2705" : a.result === "WRONG" ? "\u274C" : "\u2753";
          msg += `${icon} ${a.questionText}\n`;
          msg += `   Answer: ${a.elderAnswer || "No answer"}\n`;
          if (a.result !== "CORRECT") {
            msg += `   Correct: ${a.correctAnswer}\n`;
          }
        }

        // Vocal analysis
        if (vocalAnalysis) {
          const va = vocalAnalysis as {
            parkinsons: { currentProbability: number; futureRisk: number; details: string };
            depression: { currentState: number; futurePropensity: number; details: string };
            mood: { todayMood: string; wellnessScore: number; details: string };
          };
          msg += `\n*Vocal & Wellness Analysis:*\n`;
          msg += `Mood: ${va.mood.todayMood} | Wellness: ${va.mood.wellnessScore}/100\n`;
          msg += `${va.mood.details}\n\n`;
          msg += `Parkinson's Risk: ${va.parkinsons.currentProbability}% (future: ${va.parkinsons.futureRisk}%)\n`;
          msg += `Depression: ${va.depression.currentState}% (future: ${va.depression.futurePropensity}%)\n`;
          msg += `\n_This analysis is for caregiver awareness only._`;
        }

        await sendTelegramNotification(elderlyProfileId, msg);
      } catch (telegramErr) {
        console.error("Telegram report notification failed:", telegramErr);
      }
    } catch (err) {
      console.error("Background summary failed:", err);
    }
  })();
}

export async function POST(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId") || "";
  const answerIndex = parseInt(req.nextUrl.searchParams.get("answerIndex") || "0");
  const phase = req.nextUrl.searchParams.get("phase") || "";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  let formData: FormData | null = null;
  try {
    formData = await req.formData();
  } catch { /* no form data */ }

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
    // PHASE: EMOTIONAL — user answered the emotional question
    // ============================================================
    if (phase === "emotional") {
      const emotionalAnswer = (formData?.get("SpeechResult") as string) || "";

      // Save emotional response
      prisma.assessmentSession.update({
        where: { id: sessionId },
        data: { emotionalResponse: emotionalAnswer || null },
      }).catch((err: unknown) => console.error("Emotional save failed:", err));

      // Wait a moment for background evaluations to finish
      await sleep(2000);

      // Read evaluation results from DB
      const answers = await prisma.assessmentAnswer.findMany({
        where: { sessionId },
        orderBy: { orderIndex: "asc" },
      });

      const totalCorrect = answers.filter((a: { result: string | null }) => a.result === "CORRECT").length;
      const score = answers.length > 0 ? totalCorrect / answers.length : 0;

      // Build spoken summary
      const isArabic = profile.language === "ar";
      const summaryParts: string[] = [];

      if (isArabic) {
        summaryParts.push(`حصلت على ${totalCorrect} من ${answers.length} إجابات صحيحة.`);
      } else {
        summaryParts.push(`You got ${totalCorrect} out of ${answers.length} correct.`);
      }

      for (const a of answers) {
        if (a.result === "CORRECT") {
          summaryParts.push(isArabic
            ? `سؤال: ${a.questionText}. إجابتك صحيحة!`
            : `For the question: ${a.questionText}. You answered correctly!`);
        } else if (a.result === "WRONG") {
          summaryParts.push(isArabic
            ? `سؤال: ${a.questionText}. الإجابة الصحيحة هي ${a.correctAnswer}.`
            : `For the question: ${a.questionText}. The correct answer is ${a.correctAnswer}.`);
        } else {
          summaryParts.push(isArabic
            ? `سؤال: ${a.questionText}. لم أتمكن من سماع إجابتك. الإجابة هي ${a.correctAnswer}.`
            : `For the question: ${a.questionText}. I couldn't catch your answer. The answer is ${a.correctAnswer}.`);
        }
      }

      summaryParts.push(isArabic
        ? "شكراً لوقتك اليوم. اعتني بنفسك!"
        : "Thank you for your time today. Take care!");

      // Complete session
      prisma.assessmentSession.update({
        where: { id: sessionId },
        data: {
          status: "COMPLETED",
          overallScore: score,
          severity: score >= 0.75 ? "GREEN" : score >= 0.5 ? "YELLOW" : "RED",
        },
      }).catch((err: unknown) => console.error("Session completion failed:", err));

      generateSummaryInBackground(sessionId, profile.name, profile.language, profile.id, score);

      // Generate TTS summary using same ElevenLabs voice
      const voiceId = profile.voiceId || undefined;
      const fullSummaryText = summaryParts.join(" ");
      await mkdir(audioDir, { recursive: true });

      let summaryTwiml: string;
      try {
        const summaryBuffer = await textToSpeech(fullSummaryText, voiceId);
        const summaryFileName = `assessment-summary-${sessionId}.mp3`;
        await writeFile(path.join(audioDir, summaryFileName), summaryBuffer);
        summaryTwiml = `<Play>${baseUrl}/api/audio/${summaryFileName}</Play>`;
      } catch {
        summaryTwiml = summaryParts.map(s => `<Say>${s}</Say>`).join("\n        <Pause length=\"1\"/>\n        ");
      }

      return new NextResponse(`<Response>${summaryTwiml}</Response>`, {
        headers: { "Content-Type": "text/xml" },
      });
    }

    // ============================================================
    // COGNITIVE QUESTIONS — save recording, evaluate in bg, next question
    // ============================================================
    const currentAnswer = session.answers[answerIndex];
    if (!currentAnswer) {
      return new NextResponse("<Response><Say>Goodbye.</Say></Response>", {
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Get recording URL from Record callback
    const recordingUrl = (formData?.get("RecordingUrl") as string) || "";

    // Save recording URL to DB immediately
    if (recordingUrl) {
      prisma.assessmentAnswer.update({
        where: { id: currentAnswer.id },
        data: { recordingUrl: `${recordingUrl}.mp3` },
      }).catch((err: unknown) => console.error("Recording URL save failed:", err));

      // Start background: fetch recording → transcribe → evaluate → save
      processAnswerInBackground(
        currentAnswer.id,
        recordingUrl,
        currentAnswer.questionText,
        currentAnswer.correctAnswer,
        profile.language
      );
    } else {
      // No recording — mark as unclear
      prisma.assessmentAnswer.update({
        where: { id: currentAnswer.id },
        data: { result: "UNCLEAR" },
      }).catch((err: unknown) => console.error("UNCLEAR update failed:", err));
    }

    const nextIndex = answerIndex + 1;
    const isLastCognitive = nextIndex >= totalQuestions;

    if (isLastCognitive) {
      // All cognitive questions done — ask emotional question (pre-generated audio)
      const isArabic = profile.language === "ar";
      const lang = isArabic ? "ar-SA" : "en-US";
      const emotionalAudioFile = `assessment-emotional-${sessionId}.mp3`;
      const didntHearShortFile = `assessment-noanswer-short-${sessionId}.mp3`;

      // Use pre-generated audio, fall back to <Say> if missing
      let emotionalAudioTag: string;
      let didntHearShortTag: string;
      try {
        await access(path.join(audioDir, emotionalAudioFile));
        emotionalAudioTag = `<Play>${baseUrl}/api/audio/${emotionalAudioFile}</Play>`;
      } catch {
        const emotionalQ = isArabic
          ? "شكراً على إجاباتك. الآن، كيف تشعر اليوم؟ هل هناك شيء يزعجك أو يقلقك؟"
          : "Thanks for answering those questions. Now, how are you feeling today? Is there anything bothering you or on your mind?";
        emotionalAudioTag = `<Say>${emotionalQ}</Say>`;
      }
      try {
        await access(path.join(audioDir, didntHearShortFile));
        didntHearShortTag = `<Play>${baseUrl}/api/audio/${didntHearShortFile}</Play>`;
      } catch {
        didntHearShortTag = `<Say>I didn't hear anything.</Say>`;
      }

      const twiml = `<Response>
        <Pause length="1"/>
        ${emotionalAudioTag}
        <Gather input="speech" speechTimeout="3" language="${lang}" action="${baseUrl}/api/webhooks/assessment/next?sessionId=${sessionId}&amp;answerIndex=${answerIndex}&amp;phase=emotional" method="POST">
        </Gather>
        ${didntHearShortTag}
        <Redirect method="POST">${baseUrl}/api/webhooks/assessment/next?sessionId=${sessionId}&amp;answerIndex=${answerIndex}&amp;phase=emotional</Redirect>
      </Response>`;

      return new NextResponse(twiml, {
        headers: { "Content-Type": "text/xml" },
      });
    }

    // More cognitive questions — play next immediately
    const nextAnswer = session.answers[nextIndex];
    const pregenFileName = `assessment-q-${nextAnswer.id}.mp3`;
    const pregenPath = path.join(audioDir, pregenFileName);
    let nextQAudioTag: string;

    try {
      await access(pregenPath);
      nextQAudioTag = `<Play>${baseUrl}/api/audio/${pregenFileName}</Play>`;
    } catch {
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

    // Use pre-generated "didn't hear" audio
    const didntHearFile = `assessment-noanswer-${sessionId}.mp3`;
    let didntHearTag: string;
    try {
      await access(path.join(audioDir, didntHearFile));
      didntHearTag = `<Play>${baseUrl}/api/audio/${didntHearFile}</Play>`;
    } catch {
      didntHearTag = `<Say>I didn't hear anything. Let's move on.</Say>`;
    }

    const twiml = `<Response>
      ${nextQAudioTag}
      <Record maxLength="15" playBeep="false" timeout="3" action="${baseUrl}/api/webhooks/assessment/next?sessionId=${sessionId}&amp;answerIndex=${nextIndex}" method="POST"/>
      ${didntHearTag}
      <Redirect method="POST">${baseUrl}/api/webhooks/assessment/next?sessionId=${sessionId}&amp;answerIndex=${nextIndex}</Redirect>
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

        return new NextResponse(`<Response>
          <Say>Let's move on.</Say>
          <Redirect method="POST">${baseUrl}/api/webhooks/assessment/next?sessionId=${sessionId}&amp;answerIndex=${nextIndex}</Redirect>
        </Response>`, { headers: { "Content-Type": "text/xml" } });
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
