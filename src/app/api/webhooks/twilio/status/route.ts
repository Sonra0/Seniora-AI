import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTelegramNotification } from "@/lib/telegram-api";

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

    // Send Telegram notification
    try {
      const reminder = await prisma.reminder.findUnique({
        where: { id: log.reminderId },
        include: { elderlyProfile: true, medication: true },
      });
      if (reminder) {
        const name = reminder.elderlyProfile.name;
        const task = reminder.medication?.name || reminder.title;
        const time = reminder.scheduledTime;
        if (newStatus === "NO_ANSWER") {
          await sendTelegramNotification(
            reminder.elderlyProfileId,
            `${name} didn't answer their ${time} ${task} reminder (attempt ${log.attemptNumber}).`
          );
        } else {
          await sendTelegramNotification(
            reminder.elderlyProfileId,
            `${name}'s ${time} ${task} reminder call failed.`
          );
        }
      }
    } catch (err) {
      console.error("Telegram notification error:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
