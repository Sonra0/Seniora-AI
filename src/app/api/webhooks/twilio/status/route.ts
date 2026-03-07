import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const logId = req.nextUrl.searchParams.get("logId");
  if (!logId) return NextResponse.json({ error: "Missing logId" }, { status: 400 });

  const formData = await req.formData();
  const callStatus = formData.get("CallStatus") as string;

  const log = await prisma.reminderLog.findUnique({ where: { id: logId } });
  if (!log) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only update if the log is still in CALLING status (not already CONFIRMED)
  if (log.status === "CALLING") {
    const newStatus = callStatus === "completed" ? "NO_ANSWER" : "FAILED";
    await prisma.reminderLog.update({
      where: { id: logId },
      data: { status: newStatus },
    });
  }

  return NextResponse.json({ ok: true });
}
