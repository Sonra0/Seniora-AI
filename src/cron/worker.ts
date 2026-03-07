import cron from "node-cron";
import { prisma } from "../lib/prisma";
import { executeReminderCall } from "../lib/voice-call";

function getTimeWindow() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function getDayOfWeek() {
  return new Date().getDay();
}

async function processReminders() {
  const currentTime = getTimeWindow();
  const currentDay = getDayOfWeek();

  const reminders = await prisma.reminder.findMany({
    where: {
      active: true,
      elderlyProfile: { phoneVerified: true },
    },
    include: { elderlyProfile: true },
  });

  for (const reminder of reminders) {
    // Calculate effective trigger time (scheduled time minus lead time)
    const [h, m] = reminder.scheduledTime.split(":").map(Number);
    const scheduledMinutes = h * 60 + m;
    const effectiveMinutes = scheduledMinutes - reminder.leadTimeMinutes;
    const effectiveH = String(
      Math.floor((((effectiveMinutes % 1440) + 1440) % 1440) / 60)
    ).padStart(2, "0");
    const effectiveM = String(((effectiveMinutes % 60) + 60) % 60).padStart(
      2,
      "0"
    );
    const effectiveTime = `${effectiveH}:${effectiveM}`;

    if (effectiveTime !== currentTime) continue;

    // Check recurrence
    if (
      reminder.recurrence === "SPECIFIC_DAYS" &&
      !reminder.daysOfWeek.includes(currentDay)
    )
      continue;

    // Check if already called today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const existingLog = await prisma.reminderLog.findFirst({
      where: {
        reminderId: reminder.id,
        createdAt: { gte: today },
      },
    });

    if (existingLog) continue;

    console.log(
      `Triggering reminder: ${reminder.title} for ${reminder.elderlyProfile.name}`
    );
    await executeReminderCall(reminder.id);
  }
}

cron.schedule("* * * * *", async () => {
  console.log(`[${new Date().toISOString()}] Checking reminders...`);
  try {
    await processReminders();
  } catch (error) {
    console.error("Error processing reminders:", error);
  }
});

console.log("Cron worker started. Checking reminders every minute.");
