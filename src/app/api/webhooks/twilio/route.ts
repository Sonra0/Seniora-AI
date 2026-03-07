import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
    await prisma.reminderLog.update({
      where: { id: logId },
      data: { status: "CONFIRMED", respondedAt: new Date() },
    });
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
