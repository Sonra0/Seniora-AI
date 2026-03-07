import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const audio = formData.get("audio") as File | null;
  const name = formData.get("name") as string | null;

  if (!audio || !name) {
    return NextResponse.json(
      { error: "Audio recording and name are required" },
      { status: 400 }
    );
  }

  try {
    const elevenLabsForm = new FormData();
    elevenLabsForm.append("name", `Seniora-${name}-${user.id.slice(0, 6)}`);
    elevenLabsForm.append("files", audio, "recording.webm");
    elevenLabsForm.append("remove_background_noise", "true");

    const res = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY!,
      },
      body: elevenLabsForm,
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("ElevenLabs clone error:", errorText);
      return NextResponse.json(
        { error: "Failed to clone voice. Please try again with a clearer recording." },
        { status: 500 }
      );
    }

    const { voice_id } = await res.json();

    return NextResponse.json({ voiceId: voice_id });
  } catch (error) {
    console.error("Voice cloning failed:", error);
    return NextResponse.json(
      { error: "Voice cloning failed" },
      { status: 500 }
    );
  }
}
