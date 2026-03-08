import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId") || "";
  const answerIndex = parseInt(req.nextUrl.searchParams.get("answerIndex") || "0");
  const fillerUrl = req.nextUrl.searchParams.get("fillerUrl") || "";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  try {
    const formData = await req.formData();
    const recordingUrl = formData.get("RecordingUrl") as string;

    const session = await prisma.assessmentSession.findUnique({
      where: { id: sessionId },
      include: { answers: { orderBy: { createdAt: "asc" } } },
    });

    if (!session || !session.answers[answerIndex]) {
      return new NextResponse("<Response><Say>Something went wrong. Goodbye.</Say></Response>", {
        headers: { "Content-Type": "text/xml" },
      });
    }

    await prisma.assessmentAnswer.update({
      where: { id: session.answers[answerIndex].id },
      data: { recordingUrl: recordingUrl ? `${recordingUrl}.mp3` : null },
    });

    const twiml = `<Response>
      <Play>${fillerUrl}</Play>
      <Redirect method="POST">${baseUrl}/api/webhooks/assessment/next?sessionId=${sessionId}&amp;answerIndex=${answerIndex}&amp;recordingUrl=${encodeURIComponent(recordingUrl || "")}</Redirect>
    </Response>`;

    return new NextResponse(twiml, {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (err) {
    console.error("Assessment webhook error:", err);
    // Skip to next question on error
    const twiml = `<Response>
      <Say>Let's continue.</Say>
      <Redirect method="POST">${baseUrl}/api/webhooks/assessment/next?sessionId=${sessionId}&amp;answerIndex=${answerIndex}</Redirect>
    </Response>`;
    return new NextResponse(twiml, {
      headers: { "Content-Type": "text/xml" },
    });
  }
}
