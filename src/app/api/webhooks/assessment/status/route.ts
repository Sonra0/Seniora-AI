import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const callStatus = formData.get("CallStatus") as string;
  const sessionId = req.nextUrl.searchParams.get("sessionId");

  if (!sessionId) return NextResponse.json({ ok: true });

  const session = await prisma.assessmentSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) return NextResponse.json({ ok: true });

  if (session.status !== "COMPLETED") {
    if (callStatus === "completed" || callStatus === "no-answer" || callStatus === "busy" || callStatus === "failed") {
      await prisma.assessmentSession.update({
        where: { id: sessionId },
        data: { status: session.status === "IN_PROGRESS" ? "COMPLETED" : "FAILED" },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
