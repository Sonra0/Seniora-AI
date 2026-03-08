import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTelegramNotification } from "@/lib/telegram-api";

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
      const updatedStatus = session.status === "IN_PROGRESS" ? "COMPLETED" : "FAILED";
      await prisma.assessmentSession.update({
        where: { id: sessionId },
        data: { status: updatedStatus },
      });

      // Send Telegram notification only for failures
      // (Detailed completion reports are sent from the summary generator in the next webhook)
      if (updatedStatus === "FAILED") {
        try {
          const profile = await prisma.elderlyProfile.findUnique({
            where: { id: session.elderlyProfileId },
          });
          if (profile) {
            await sendTelegramNotification(
              session.elderlyProfileId,
              `${profile.name}'s assessment call failed.`
            );
          }
        } catch (err) {
          console.error("Telegram notification error:", err);
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
