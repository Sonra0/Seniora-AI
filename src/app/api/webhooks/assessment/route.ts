import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId") || "";
  const answerIndex = parseInt(req.nextUrl.searchParams.get("answerIndex") || "0");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  try {
    const formData = await req.formData();
    // With <Gather input="speech">, Twilio sends transcription directly
    const speechResult = (formData.get("SpeechResult") as string) || "";

    const twiml = `<Response>
      <Redirect method="POST">${baseUrl}/api/webhooks/assessment/next?sessionId=${sessionId}&amp;answerIndex=${answerIndex}&amp;speechResult=${encodeURIComponent(speechResult)}</Redirect>
    </Response>`;

    return new NextResponse(twiml, {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (err) {
    console.error("Assessment webhook error:", err);
    const twiml = `<Response>
      <Say>Let's continue.</Say>
      <Redirect method="POST">${baseUrl}/api/webhooks/assessment/next?sessionId=${sessionId}&amp;answerIndex=${answerIndex}&amp;speechResult=</Redirect>
    </Response>`;
    return new NextResponse(twiml, {
      headers: { "Content-Type": "text/xml" },
    });
  }
}
