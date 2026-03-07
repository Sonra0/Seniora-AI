import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { textToSpeech, ELEVENLABS_VOICES } from "@/lib/elevenlabs";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { voiceId } = await req.json();

  if (!voiceId || !ELEVENLABS_VOICES.some((v) => v.id === voiceId)) {
    return NextResponse.json({ error: "Invalid voice ID" }, { status: 400 });
  }

  try {
    const audioBuffer = await textToSpeech(
      "Hello, this is a reminder from your caregiver. It's time to take your medication.",
      voiceId
    );

    return new NextResponse(new Uint8Array(audioBuffer), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    console.error("Voice preview failed:", error);
    return NextResponse.json(
      { error: "Failed to generate preview" },
      { status: 500 }
    );
  }
}
