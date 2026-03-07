import { prisma } from "./prisma";
import { twilioClient } from "./twilio";
import { generateReminderScript } from "./gemini";
import { textToSpeech } from "./elevenlabs";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function executeReminderCall(reminderId: string) {
  const reminder = await prisma.reminder.findUnique({
    where: { id: reminderId },
    include: { elderlyProfile: true, medication: true },
  });

  if (!reminder || !reminder.elderlyProfile.phoneVerified) return;

  const log = await prisma.reminderLog.create({
    data: { reminderId, status: "CALLING", calledAt: new Date() },
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

    const audioBuffer = await textToSpeech(script);

    const audioDir = path.join(process.cwd(), "public", "audio");
    await mkdir(audioDir, { recursive: true });
    const audioFileName = `reminder-${log.id}.mp3`;
    const audioPath = path.join(audioDir, audioFileName);
    await writeFile(audioPath, audioBuffer);

    const audioUrl = `${process.env.NEXT_PUBLIC_APP_URL}/audio/${audioFileName}`;

    const call = await twilioClient.calls.create({
      to: reminder.elderlyProfile.phone,
      from: process.env.TWILIO_PHONE_NUMBER!,
      twiml: `<Response>
        <Play>${audioUrl}</Play>
        <Gather numDigits="1" action="${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio?logId=${log.id}" method="POST" timeout="10">
          <Say>Press 1 to confirm you heard this reminder. Press 2 to hear it again.</Say>
        </Gather>
        <Say>No response received. Goodbye.</Say>
      </Response>`,
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
