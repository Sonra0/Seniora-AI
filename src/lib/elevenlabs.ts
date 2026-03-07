export const ELEVENLABS_VOICES = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", gender: "Female" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", gender: "Female" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", gender: "Female" },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian", gender: "Male" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", gender: "Male" },
] as const;

export const DEFAULT_VOICE_ID = ELEVENLABS_VOICES[0].id;

export async function textToSpeech(text: string, voiceId?: string): Promise<Buffer> {
  const voice = voiceId || process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.75, similarity_boost: 0.75 },
      }),
    }
  );

  if (!response.ok) throw new Error(`ElevenLabs error: ${response.statusText}`);
  return Buffer.from(await response.arrayBuffer());
}
