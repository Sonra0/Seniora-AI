import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getProfileAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { executeAssessmentCall } from "@/lib/assessment-call";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const role = await getProfileAccess(user, id);
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const profile = await prisma.elderlyProfile.findUnique({ where: { id } });
  if (!profile || !profile.phoneVerified) {
    return NextResponse.json({ error: "Phone not verified" }, { status: 400 });
  }

  const config = await prisma.assessmentConfig.findUnique({
    where: { elderlyProfileId: id },
  });

  if (!config) {
    return NextResponse.json({ error: "No assessment config found" }, { status: 400 });
  }

  const allQuestions = await prisma.assessmentQuestion.findMany({
    where: {
      elderlyProfileId: id,
      correctAnswer: { not: "" },
    },
  });

  if (allQuestions.length < 10) {
    return NextResponse.json({
      error: `Only ${allQuestions.length} questions with answers (need 10+)`,
      questions: allQuestions.length,
    }, { status: 400 });
  }

  const todayStr = new Date().toLocaleDateString("en-CA");

  // Clean up any existing session for today
  const existing = await prisma.assessmentSession.findFirst({
    where: { configId: config.id, date: todayStr },
  });
  if (existing) {
    await prisma.assessmentAnswer.deleteMany({ where: { sessionId: existing.id } });
    await prisma.assessmentSession.delete({ where: { id: existing.id } });
  }

  const shuffled = allQuestions.sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, config.questionsPerCall);

  const session = await prisma.assessmentSession.create({
    data: {
      elderlyProfileId: id,
      configId: config.id,
      date: todayStr,
      status: "PENDING",
      answers: {
        create: selected.map((q, i) => ({
          questionId: q.id,
          questionText: q.questionText,
          correctAnswer: q.correctAnswer,
          orderIndex: i,
        })),
      },
    },
  });

  try {
    await executeAssessmentCall(session.id);
    return NextResponse.json({ ok: true, sessionId: session.id });
  } catch (err) {
    return NextResponse.json({
      error: "Call failed",
      details: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}
