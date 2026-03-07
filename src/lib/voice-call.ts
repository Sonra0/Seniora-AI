import { prisma } from "./prisma";
import { twilioClient } from "./twilio";
import { generateReminderScript } from "./gemini";
import { textToSpeech } from "./elevenlabs";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

function escapeXml(str: string) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function executeReminderCall(reminderId: string, attemptNumber: number = 1) {
  const reminder = await prisma.reminder.findUnique({
    where: { id: reminderId },
    include: { elderlyProfile: true, medication: true },
  });

  if (!reminder || !reminder.elderlyProfile.phoneVerified) return;

  const log = await prisma.reminderLog.create({
    data: { reminderId, status: "CALLING", attemptNumber, calledAt: new Date() },
  });

  try {
    const hour = new Date().getHours();
    const timeOfDay =
      hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

    const script = await generateReminderScript({
      elderlyName: reminder.elderlyProfile.name,
      medication: reminder.medication
        ? {
            name: reminder.medication.name,
            dosage: reminder.medication.dosage || undefined,
            instructions: reminder.medication.instructions || undefined,
          }
        : undefined,
      customTask: reminder.type === "CUSTOM" ? reminder.title : undefined,
      language: reminder.elderlyProfile.language,
      timeOfDay,
    });

    // Try ElevenLabs TTS, fall back to Twilio <Say> if it fails
    let twiml: string;
    let audioUrl: string | null = null;

    try {
      const audioBuffer = await textToSpeech(script);
      const audioDir = path.join(process.cwd(), "public", "audio");
      await mkdir(audioDir, { recursive: true });
      const audioFileName = `reminder-${log.id}.mp3`;
      const audioPath = path.join(audioDir, audioFileName);
      await writeFile(audioPath, audioBuffer);
      audioUrl = `${process.env.NEXT_PUBLIC_APP_URL}/audio/${audioFileName}`;

      twiml = `<Response>
        <Play>${audioUrl}</Play>
        <Gather numDigits="1" action="${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio?logId=${log.id}" method="POST" timeout="10">
          <Say>Press 1 to confirm you heard this reminder. Press 2 to hear it again.</Say>
        </Gather>
        <Say>No response received. Goodbye.</Say>
      </Response>`;
    } catch (ttsError) {
      console.warn("ElevenLabs TTS failed, using Twilio Say fallback:", ttsError);
      const escapedScript = escapeXml(script);
      twiml = `<Response>
        <Say>${escapedScript}</Say>
        <Gather numDigits="1" action="${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio?logId=${log.id}" method="POST" timeout="10">
          <Say>Press 1 to confirm you heard this reminder. Press 2 to hear it again.</Say>
        </Gather>
        <Say>No response received. Goodbye.</Say>
      </Response>`;
    }

    const call = await twilioClient.calls.create({
      to: reminder.elderlyProfile.phone,
      from: process.env.TWILIO_PHONE_NUMBER!,
      twiml,
      statusCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio/status?logId=${log.id}`,
      statusCallbackEvent: ["completed"],
      statusCallbackMethod: "POST",
    });

    await prisma.reminderLog.update({
      where: { id: log.id },
      data: { audioUrl, twilioCallSid: call.sid },
    });
  } catch (error) {
    await prisma.reminderLog.update({
      where: { id: log.id },
      data: { status: "FAILED" },
    });
    console.error("Voice call failed:", error);
  }
}

export async function callEmergencyContact(elderlyProfileId: string) {
  const profile = await prisma.elderlyProfile.findUnique({
    where: { id: elderlyProfileId },
  });

  if (!profile || !profile.emergencyPhone) {
    console.warn(`No emergency contact for elderly profile ${elderlyProfileId}`);
    return;
  }

  const escapedName = escapeXml(profile.name);
  const twiml = `<Response>
    <Say>This is an urgent message from Seniora Care. We have been unable to reach ${escapedName} after multiple reminder call attempts. Please check on them as soon as possible. Thank you.</Say>
  </Response>`;

  try {
    await twilioClient.calls.create({
      to: profile.emergencyPhone,
      from: process.env.TWILIO_PHONE_NUMBER!,
      twiml,
    });
    console.log(`Emergency call placed to ${profile.emergencyPhone} for ${profile.name}`);
  } catch (error) {
    console.error(`Failed to call emergency contact for ${profile.name}:`, error);
  }
}
