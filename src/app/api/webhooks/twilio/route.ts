import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTelegramNotification } from "@/lib/telegram-api";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const digits = formData.get("Digits") as string;
  const logId = req.nextUrl.searchParams.get("logId");

  if (!logId) {
    return new NextResponse(
      "<Response><Say>Error.</Say></Response>",
      { headers: { "Content-Type": "text/xml" } }
    );
  }

  if (digits === "1") {
    const log = await prisma.reminderLog.update({
      where: { id: logId },
      data: { status: "CONFIRMED", respondedAt: new Date() },
    });

    // Only deactivate one-time reminders; recurring ones should keep firing
    const reminder = await prisma.reminder.findUnique({
      where: { id: log.reminderId },
      include: { elderlyProfile: true, medication: true },
    });
    if (reminder && reminder.recurrence === "NONE") {
      await prisma.reminder.update({
        where: { id: log.reminderId },
        data: { active: false },
      });
    }

    // Send Telegram notification for confirmation
    if (reminder) {
      try {
        const name = reminder.elderlyProfile.name;
        const task = reminder.medication?.name || reminder.title;
        await sendTelegramNotification(
          reminder.elderlyProfileId,
          `${name} confirmed their ${reminder.scheduledTime} ${task} reminder.`
        );
      } catch (err) {
        console.error("Telegram notification error:", err);
      }
    }

    return new NextResponse(
      "<Response><Say>Thank you! Your confirmation has been recorded. Take care!</Say></Response>",
      { headers: { "Content-Type": "text/xml" } }
    );
  }

  if (digits === "2") {
    const log = await prisma.reminderLog.findUnique({ where: { id: logId } });
    return new NextResponse(
      `<Response>
        <Play>${log?.audioUrl}</Play>
        <Gather numDigits="1" action="${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio?logId=${logId}" method="POST" timeout="10">
          <Say>Press 1 to confirm. Press 2 to hear again.</Say>
        </Gather>
      </Response>`,
      { headers: { "Content-Type": "text/xml" } }
    );
  }

  return new NextResponse(
    "<Response><Say>Goodbye.</Say></Response>",
    { headers: { "Content-Type": "text/xml" } }
  );
}
