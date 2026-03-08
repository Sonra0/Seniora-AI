import "dotenv/config";
import cron from "node-cron";
import { prisma } from "../lib/prisma";
import { executeReminderCall, callEmergencyContact } from "../lib/voice-call";
import { executeAssessmentCall } from "../lib/assessment-call";

const MAX_ATTEMPTS = 3;
const RETRY_INTERVAL_MINUTES = 5;

function getTimeInTimezone(timezone: string) {
  const now = new Date();
  const formatted = now.toLocaleString("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  // toLocaleString may return "24:00" as "00:00" — normalize
  const [h, m] = formatted.split(":").map((s) => s.trim());
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
}

function getDayOfWeekInTimezone(timezone: string) {
  const now = new Date();
  const dayStr = now.toLocaleString("en-US", { timeZone: timezone, weekday: "short" });
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return dayMap[dayStr] ?? now.getDay();
}

function getTodayDateStringInTimezone(timezone: string) {
  const now = new Date();
  const parts = now.toLocaleDateString("en-CA", { timeZone: timezone }).split("-");
  return parts.join("-");
}

function getNowMinutesInTimezone(timezone: string) {
  const timeStr = getTimeInTimezone(timezone);
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

async function deactivatePastReminders() {
  // Find all active reminders with a scheduledDate
  const reminders = await prisma.reminder.findMany({
    where: { active: true, scheduledDate: { not: null } },
    include: { elderlyProfile: { select: { timezone: true } } },
  });

  for (const reminder of reminders) {
    const tz = reminder.elderlyProfile.timezone || "UTC";
    const todayStr = getTodayDateStringInTimezone(tz);
    if (reminder.scheduledDate! < todayStr) {
      await prisma.reminder.update({
        where: { id: reminder.id },
        data: { active: false },
      });
      console.log(`Deactivated past-date reminder: ${reminder.title}`);
    }
  }
}

async function processReminders() {
  const reminders = await prisma.reminder.findMany({
    where: {
      active: true,
      elderlyProfile: { phoneVerified: true },
    },
    include: { elderlyProfile: true },
  });

  const INTERVAL_HOURS: Record<string, number> = {
    EVERY_1_HOUR: 1,
    EVERY_4_HOURS: 4,
    EVERY_6_HOURS: 6,
    EVERY_8_HOURS: 8,
    EVERY_12_HOURS: 12,
  };

  for (const reminder of reminders) {
    const tz = reminder.elderlyProfile.timezone || "UTC";
    const currentTime = getTimeInTimezone(tz);
    const currentDay = getDayOfWeekInTimezone(tz);
    const todayStr = getTodayDateStringInTimezone(tz);

    // If reminder has a specific date, only fire on that date
    if (reminder.scheduledDate && reminder.scheduledDate !== todayStr) continue;

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

    const intervalHours = INTERVAL_HOURS[reminder.recurrence];

    if (reminder.recurrence === "NONE") {
      // One-time reminder: must match exact time, check not already fired
      if (effectiveTime !== currentTime) continue;
      const existingLog = await prisma.reminderLog.findFirst({
        where: { reminderId: reminder.id },
      });
      if (existingLog) continue;
    } else if (intervalHours) {
      // Hour-based intervals: first call at scheduledTime, then repeat every N hours
      const nowMinutes = getNowMinutesInTimezone(tz);
      const startMinutes = h * 60 + m;

      // Only fire at or after the scheduled start time
      if (nowMinutes < startMinutes) continue;

      // Check minutes since start — must be a multiple of the interval
      const minutesSinceStart = nowMinutes - startMinutes;
      if (minutesSinceStart % (intervalHours * 60) !== 0) continue;

      // Check if already called at this time slot
      const slotStart = new Date();
      slotStart.setMinutes(slotStart.getMinutes() - 1, 0, 0);
      const existingLog = await prisma.reminderLog.findFirst({
        where: {
          reminderId: reminder.id,
          attemptNumber: 1,
          createdAt: { gte: slotStart },
        },
      });
      if (existingLog) continue;
    } else {
      // Time-based recurrences: must match the exact scheduled time
      if (effectiveTime !== currentTime) continue;

      if (reminder.recurrence === "SPECIFIC_DAYS") {
        if (!reminder.daysOfWeek.includes(currentDay)) continue;
      } else if (reminder.recurrence === "EVERY_OTHER_DAY") {
        // Check last successful trigger — must be at least 2 days ago
        const lastLog = await prisma.reminderLog.findFirst({
          where: { reminderId: reminder.id, attemptNumber: 1 },
          orderBy: { createdAt: "desc" },
        });
        if (lastLog) {
          const daysSinceLast = (Date.now() - new Date(lastLog.createdAt).getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceLast < 1.5) continue;
        }
      } else if (reminder.recurrence === "WEEKLY") {
        const lastLog = await prisma.reminderLog.findFirst({
          where: { reminderId: reminder.id, attemptNumber: 1 },
          orderBy: { createdAt: "desc" },
        });
        if (lastLog) {
          const daysSinceLast = (Date.now() - new Date(lastLog.createdAt).getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceLast < 6.5) continue;
        }
      } else if (reminder.recurrence === "MONTHLY") {
        const lastLog = await prisma.reminderLog.findFirst({
          where: { reminderId: reminder.id, attemptNumber: 1 },
          orderBy: { createdAt: "desc" },
        });
        if (lastLog) {
          const daysSinceLast = (Date.now() - new Date(lastLog.createdAt).getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceLast < 28) continue;
        }
      }

      // For DAILY and non-interval: check if already called today
      if (reminder.recurrence === "DAILY" || reminder.recurrence === "SPECIFIC_DAYS") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const existingLog = await prisma.reminderLog.findFirst({
          where: {
            reminderId: reminder.id,
            createdAt: { gte: today },
          },
        });
        if (existingLog) continue;
      }
    }

    console.log(
      `Triggering reminder: ${reminder.title} for ${reminder.elderlyProfile.name}`
    );
    await executeReminderCall(reminder.id, 1);
  }
}

async function processRetries() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find today's logs that failed or had no answer and haven't reached max attempts
  const failedLogs = await prisma.reminderLog.findMany({
    where: {
      createdAt: { gte: today },
      status: { in: ["FAILED", "NO_ANSWER"] },
      attemptNumber: { lt: MAX_ATTEMPTS },
    },
    include: {
      reminder: { include: { elderlyProfile: true } },
    },
  });

  for (const log of failedLogs) {
    if (!log.reminder.active) continue;

    // Check if a newer log already exists for this reminder today (already retried)
    const newerLog = await prisma.reminderLog.findFirst({
      where: {
        reminderId: log.reminderId,
        createdAt: { gte: today },
        attemptNumber: { gt: log.attemptNumber },
      },
    });
    if (newerLog) continue;

    // Check if enough time has passed since the last attempt
    const lastCallTime = log.calledAt || log.createdAt;
    const minutesSinceLastCall =
      (Date.now() - new Date(lastCallTime).getTime()) / (1000 * 60);

    if (minutesSinceLastCall < RETRY_INTERVAL_MINUTES) continue;

    console.log(
      `Retrying reminder (attempt ${log.attemptNumber + 1}/${MAX_ATTEMPTS}): ${log.reminder.title} for ${log.reminder.elderlyProfile.name}`
    );
    await executeReminderCall(log.reminderId, log.attemptNumber + 1);
  }
}

async function processEmergencyCalls() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find today's final-attempt logs that failed/no-answer
  const finalFailedLogs = await prisma.reminderLog.findMany({
    where: {
      createdAt: { gte: today },
      status: { in: ["FAILED", "NO_ANSWER"] },
      attemptNumber: MAX_ATTEMPTS,
    },
    include: {
      reminder: { include: { elderlyProfile: true } },
    },
  });

  // Track which elderly profiles we've already called emergency for today
  const calledProfiles = new Set<string>();

  for (const log of finalFailedLogs) {
    const profileId = log.reminder.elderlyProfileId;
    if (calledProfiles.has(profileId)) continue;
    if (!log.reminder.elderlyProfile.emergencyPhone) continue;

    // Check if we already placed an emergency call today (avoid duplicates)
    // We use a simple marker: deactivate the reminder after emergency call
    if (!log.reminder.active) continue;

    console.log(
      `All ${MAX_ATTEMPTS} attempts failed for "${log.reminder.title}" — calling emergency contact for ${log.reminder.elderlyProfile.name}`
    );
    await callEmergencyContact(profileId);
    calledProfiles.add(profileId);

    // Only deactivate one-time reminders; recurring ones should keep firing
    if (log.reminder.recurrence === "NONE") {
      await prisma.reminder.update({
        where: { id: log.reminderId },
        data: { active: false },
      });
    }
  }
}

async function processAssessments() {
  const configs = await prisma.assessmentConfig.findMany({
    where: {
      active: true,
      elderlyProfile: { phoneVerified: true },
    },
    include: { elderlyProfile: true },
  });

  for (const config of configs) {
    const tz = config.elderlyProfile.timezone || "UTC";
    const currentTime = getTimeInTimezone(tz);

    if (config.scheduledTime !== currentTime) continue;

    const todayStr = getTodayDateStringInTimezone(tz);

    const existingSession = await prisma.assessmentSession.findFirst({
      where: { configId: config.id, date: todayStr },
    });
    // Only skip if a session exists and is COMPLETED or actively IN_PROGRESS
    if (existingSession && (existingSession.status === "COMPLETED" || existingSession.status === "IN_PROGRESS")) continue;
    // Clean up any failed/pending session before creating a new one
    if (existingSession) {
      await prisma.assessmentAnswer.deleteMany({ where: { sessionId: existingSession.id } });
      await prisma.assessmentSession.delete({ where: { id: existingSession.id } });
    }

    const allQuestions = await prisma.assessmentQuestion.findMany({
      where: {
        elderlyProfileId: config.elderlyProfileId,
        correctAnswer: { not: "" },
      },
    });

    if (allQuestions.length < 10) continue;

    const shuffled = allQuestions.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, config.questionsPerCall);

    const session = await prisma.assessmentSession.create({
      data: {
        elderlyProfileId: config.elderlyProfileId,
        configId: config.id,
        date: todayStr,
        status: "PENDING",
        answers: {
          create: selected.map((q, i) => ({
            questionId: q.id,
            questionText: q.questionText,
            correctAnswer: q.correctAnswer,
            orderIndex: i,
          })),
        },
      },
    });

    console.log(`Triggering assessment call for ${config.elderlyProfile.name}`);
    await executeAssessmentCall(session.id);
  }
}

cron.schedule("* * * * *", async () => {
  console.log(`[${new Date().toISOString()}] Checking reminders...`);
  try {
    await deactivatePastReminders();
    await processReminders();
    await processRetries();
    await processEmergencyCalls();
    await processAssessments();
  } catch (error) {
    console.error("Error processing reminders:", error);
  }
});

console.log("Cron worker started. Checking reminders every minute.");
