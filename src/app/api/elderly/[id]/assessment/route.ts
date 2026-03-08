import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getProfileAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const role = await getProfileAccess(user, id);
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const config = await prisma.assessmentConfig.findUnique({
    where: { elderlyProfileId: id },
  });

  const questions = await prisma.assessmentQuestion.findMany({
    where: { elderlyProfileId: id },
    orderBy: { createdAt: "asc" },
  });

  const sessions = await prisma.assessmentSession.findMany({
    where: { elderlyProfileId: id },
    include: { answers: { orderBy: { orderIndex: "asc" } } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return NextResponse.json({ config, questions, sessions });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const role = await getProfileAccess(user, id);
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { scheduledTime, active, questionsPerCall } = await req.json();

  if (active) {
    const questionCount = await prisma.assessmentQuestion.count({
      where: { elderlyProfileId: id },
    });
    if (questionCount < 10) {
      return NextResponse.json(
        { error: "At least 10 questions with answers are required to activate assessment" },
        { status: 400 }
      );
    }
  }

  const config = await prisma.assessmentConfig.upsert({
    where: { elderlyProfileId: id },
    create: {
      elderlyProfileId: id,
      scheduledTime: scheduledTime || "09:00",
      questionsPerCall: questionsPerCall || 4,
      active: active || false,
    },
    update: {
      ...(scheduledTime !== undefined && { scheduledTime }),
      ...(active !== undefined && { active }),
      ...(questionsPerCall !== undefined && { questionsPerCall }),
    },
  });

  return NextResponse.json(config);
}
