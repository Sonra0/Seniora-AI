import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getProfileAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";

const DEFAULT_QUESTIONS = [
  { category: "PERSONAL", questionText: "What is your date of birth?" },
  { category: "PERSONAL", questionText: "What is your full name?" },
  { category: "PERSONAL", questionText: "What is your home address?" },
  { category: "PERSONAL", questionText: "What year were you born?" },
  { category: "PERSONAL", questionText: "What is your phone number?" },
  { category: "PERSONAL", questionText: "Where were you born?" },
  { category: "PERSONAL", questionText: "What is your wedding anniversary?" },
  { category: "PERSONAL", questionText: "What is your spouse's name?" },
  { category: "ORIENTATION", questionText: "What day of the week is it today?" },
  { category: "ORIENTATION", questionText: "What month are we in?" },
  { category: "ORIENTATION", questionText: "What year is it?" },
  { category: "ORIENTATION", questionText: "What season are we in?" },
  { category: "ORIENTATION", questionText: "What did you have for breakfast today?" },
  { category: "ORIENTATION", questionText: "What time of day is it — morning, afternoon, or evening?" },
  { category: "ORIENTATION", questionText: "What city do you live in?" },
  { category: "ORIENTATION", questionText: "What is today's date?" },
  { category: "PEOPLE", questionText: "What is your caregiver's name?" },
  { category: "PEOPLE", questionText: "What is your doctor's name?" },
  { category: "PEOPLE", questionText: "How many children do you have?" },
  { category: "PEOPLE", questionText: "What are your children's names?" },
  { category: "PEOPLE", questionText: "What is your son or daughter's birthday?" },
  { category: "PEOPLE", questionText: "Who visited you last?" },
  { category: "PEOPLE", questionText: "What is your best friend's name?" },
  { category: "GENERAL", questionText: "What country do you live in?" },
  { category: "GENERAL", questionText: "What is 5 plus 3?" },
  { category: "GENERAL", questionText: "What color is the sky?" },
  { category: "GENERAL", questionText: "How many days are in a week?" },
  { category: "GENERAL", questionText: "What do you use to brush your teeth?" },
  { category: "GENERAL", questionText: "What is the opposite of hot?" },
  { category: "GENERAL", questionText: "Name any three animals." },
] as const;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const role = await getProfileAccess(user, id);
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { questions } = await req.json() as {
    questions: { id?: string; category: string; questionText: string; correctAnswer: string }[];
  };

  if (!questions || !Array.isArray(questions)) {
    return NextResponse.json({ error: "Questions array required" }, { status: 400 });
  }

  await prisma.assessmentQuestion.deleteMany({
    where: { elderlyProfileId: id },
  });

  const created = await prisma.assessmentQuestion.createMany({
    data: questions.map((q) => ({
      elderlyProfileId: id,
      category: q.category as "PERSONAL" | "ORIENTATION" | "PEOPLE" | "GENERAL",
      questionText: q.questionText,
      correctAnswer: q.correctAnswer,
    })),
  });

  return NextResponse.json({ count: created.count });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const role = await getProfileAccess(user, id);
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let questions = await prisma.assessmentQuestion.findMany({
    where: { elderlyProfileId: id },
    orderBy: { createdAt: "asc" },
  });

  if (questions.length === 0) {
    return NextResponse.json({
      questions: DEFAULT_QUESTIONS.map((q, i) => ({
        id: `default-${i}`,
        ...q,
        correctAnswer: "",
        elderlyProfileId: id,
      })),
      isDefault: true,
    });
  }

  return NextResponse.json({ questions, isDefault: false });
}
