import type { Recurrence } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

export type MissingField = "title" | "name" | "scheduledTime" | "daysOfWeek";

export interface ProfileOption {
  id: string;
  name: string;
}

export interface DraftPayload {
  title?: string;
  description?: string;
  name?: string;
  dosage?: string;
  instructions?: string;
  scheduledTime?: string;
  scheduledDate?: string;
  recurrence?: Recurrence;
  daysOfWeek?: number[];
  leadTimeMinutes?: number;
}

export interface ConversationState {
  draft?: DraftPayload;
  missingFields?: MissingField[];
  pendingProfileOptions?: ProfileOption[];
}

export const VALID_RECURRENCES: Recurrence[] = [
  "NONE",
  "EVERY_1_HOUR",
  "EVERY_4_HOURS",
  "EVERY_6_HOURS",
  "EVERY_8_HOURS",
  "EVERY_12_HOURS",
  "DAILY",
  "EVERY_OTHER_DAY",
  "WEEKLY",
  "MONTHLY",
  "SPECIFIC_DAYS",
];

export const CANCEL_WORDS = new Set(["cancel", "stop", "reset", "start over", "clear"]);

export function normalizePhone(phone: string): string {
  const stripped = phone.replace(/^whatsapp:/i, "").trim();
  const digits = stripped.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

export function parseTimeFromText(text: string): string | null {
  const hhmm = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (hhmm) {
    const h = hhmm[1].padStart(2, "0");
    const m = hhmm[2];
    return `${h}:${m}`;
  }

  const ampm = text.match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b/i);
  if (!ampm) return null;

  const rawHour = Number(ampm[1]);
  const minutes = ampm[2] || "00";
  const period = ampm[3].toLowerCase();

  let hour = rawHour % 12;
  if (period === "pm") hour += 12;

  return `${String(hour).padStart(2, "0")}:${minutes}`;
}

export function parseDateFromText(text: string): string | null {
  const match = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  return match ? match[1] : null;
}

export function parseDaysOfWeekFromText(text: string): number[] | null {
  const lower = text.toLowerCase();
  const map: Record<string, number> = {
    sun: 0,
    sunday: 0,
    mon: 1,
    monday: 1,
    tue: 2,
    tues: 2,
    tuesday: 2,
    wed: 3,
    wednesday: 3,
    thu: 4,
    thur: 4,
    thurs: 4,
    thursday: 4,
    fri: 5,
    friday: 5,
    sat: 6,
    saturday: 6,
  };

  const matched = Object.entries(map)
    .filter(([k]) => new RegExp(`\\b${k}\\b`, "i").test(lower))
    .map(([, v]) => v);

  if (matched.length > 0) {
    return Array.from(new Set(matched)).sort((a, b) => a - b);
  }

  if (lower.includes("weekdays")) return [1, 2, 3, 4, 5];
  if (lower.includes("weekends")) return [0, 6];
  if (lower.includes("every day") || lower.includes("daily")) return [0, 1, 2, 3, 4, 5, 6];

  return null;
}

export function recurrenceFromText(text: string): Recurrence | undefined {
  const lower = text.toLowerCase();

  if (lower.includes("every other day")) return "EVERY_OTHER_DAY";
  if (lower.match(/every\s*1\s*hour/) || lower.includes("hourly")) return "EVERY_1_HOUR";
  if (lower.match(/every\s*4\s*hour/)) return "EVERY_4_HOURS";
  if (lower.match(/every\s*6\s*hour/)) return "EVERY_6_HOURS";
  if (lower.match(/every\s*8\s*hour/)) return "EVERY_8_HOURS";
  if (lower.match(/every\s*12\s*hour/)) return "EVERY_12_HOURS";
  if (lower.includes("specific day") || parseDaysOfWeekFromText(lower)) return "SPECIFIC_DAYS";
  if (lower.includes("weekly") || lower.includes("every week")) return "WEEKLY";
  if (lower.includes("monthly") || lower.includes("every month")) return "MONTHLY";
  if (lower.includes("daily") || lower.includes("every day")) return "DAILY";
  if (lower.includes("one time") || lower.includes("once")) return "NONE";

  return undefined;
}

export function normalizeRecurrence(value?: string | null): Recurrence | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toUpperCase();
  if (VALID_RECURRENCES.includes(normalized as Recurrence)) {
    return normalized as Recurrence;
  }
  return undefined;
}

export function detectCancel(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return CANCEL_WORDS.has(normalized);
}

export function cleanString(value?: string | null): string | undefined {
  if (!value) return undefined;
  const cleaned = value.trim();
  return cleaned ? cleaned : undefined;
}

export function fieldPrompt(intent: string, field: MissingField): string {
  if (field === "scheduledTime") {
    return "What time should I schedule it? (example: 08:30 or 8:30 PM)";
  }

  if (field === "daysOfWeek") {
    return "Which days should it repeat? (example: Mon, Wed, Fri)";
  }

  if (intent === "MEDICATION" && field === "name") {
    return "What is the medication name?";
  }

  return "What should the reminder title be?";
}

export function getMissingFields(intent: string, draft: DraftPayload): MissingField[] {
  const missing: MissingField[] = [];

  if (intent === "REMINDER") {
    if (!cleanString(draft.title)) missing.push("title");
    if (!cleanString(draft.scheduledTime)) missing.push("scheduledTime");
    if (draft.recurrence === "SPECIFIC_DAYS" && (!draft.daysOfWeek || draft.daysOfWeek.length === 0)) {
      missing.push("daysOfWeek");
    }
  }

  if (intent === "MEDICATION") {
    if (!cleanString(draft.name)) missing.push("name");
    if (!cleanString(draft.scheduledTime)) missing.push("scheduledTime");
    if (draft.recurrence === "SPECIFIC_DAYS" && (!draft.daysOfWeek || draft.daysOfWeek.length === 0)) {
      missing.push("daysOfWeek");
    }
  }

  if (intent === "ASSESSMENT") {
    if (!cleanString(draft.scheduledTime)) missing.push("scheduledTime");
  }

  return missing;
}

export function mergeDraftWithMessage(intent: string, draft: DraftPayload, message: string): void {
  if (!draft.scheduledTime) {
    const parsedTime = parseTimeFromText(message);
    if (parsedTime) draft.scheduledTime = parsedTime;
  }

  if (!draft.scheduledDate) {
    const parsedDate = parseDateFromText(message);
    if (parsedDate) draft.scheduledDate = parsedDate;
  }

  if (!draft.recurrence) {
    const parsedRecurrence = recurrenceFromText(message);
    if (parsedRecurrence) draft.recurrence = parsedRecurrence;
  }

  if (draft.recurrence === "SPECIFIC_DAYS" && (!draft.daysOfWeek || draft.daysOfWeek.length === 0)) {
    const parsedDays = parseDaysOfWeekFromText(message);
    if (parsedDays) draft.daysOfWeek = parsedDays;
  }

  if (intent === "REMINDER" && !draft.title && message.trim()) {
    if (!/\b(reminder|schedule|set|at|for)\b/i.test(message)) {
      draft.title = message.trim();
    }
  }

  if (intent === "MEDICATION" && !draft.name && message.trim()) {
    if (!/\b(medication|medicine|schedule|set|at|for)\b/i.test(message)) {
      draft.name = message.trim();
    }
  }
}

export function findProfileByName(options: ProfileOption[], name?: string | null): ProfileOption | null {
  const target = name?.toLowerCase().trim();
  if (!target) return null;

  const exact = options.find((p) => p.name.toLowerCase() === target);
  if (exact) return exact;

  return (
    options.find(
      (p) => p.name.toLowerCase().includes(target) || target.includes(p.name.toLowerCase())
    ) || null
  );
}

export function findProfileBySelection(options: ProfileOption[], text: string): ProfileOption | null {
  const trimmed = text.trim();
  const asNumber = Number(trimmed);
  if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= options.length) {
    return options[asNumber - 1];
  }
  return findProfileByName(options, trimmed);
}

export function listProfiles(options: ProfileOption[]): string {
  return options.map((p, index) => `${index + 1}. ${p.name}`).join("\n");
}

/* ------------------------------------------------------------------ */
/*  DB operation helpers (shared between WhatsApp and Telegram)       */
/* ------------------------------------------------------------------ */

export async function createCustomReminder(elderlyProfileId: string, draft: DraftPayload): Promise<void> {
  const recurrenceValue = draft.recurrence || "NONE";
  const daysOfWeek = recurrenceValue === "SPECIFIC_DAYS" ? draft.daysOfWeek || [] : [];
  await prisma.reminder.create({
    data: {
      type: "CUSTOM",
      title: draft.title!,
      description: draft.description || null,
      scheduledTime: draft.scheduledTime!,
      scheduledDate: draft.scheduledDate || null,
      recurrence: recurrenceValue,
      daysOfWeek,
      leadTimeMinutes: draft.leadTimeMinutes ?? 0,
      elderlyProfileId,
    },
  });
}

export async function createMedicationWithReminder(elderlyProfileId: string, draft: DraftPayload): Promise<void> {
  const recurrenceValue = draft.recurrence || "DAILY";
  const daysOfWeek = recurrenceValue === "SPECIFIC_DAYS" ? draft.daysOfWeek || [] : [];
  await prisma.$transaction(async (tx) => {
    const medication = await tx.medication.create({
      data: {
        name: draft.name!,
        dosage: draft.dosage || null,
        instructions: draft.instructions || null,
        elderlyProfileId,
      },
    });
    await tx.reminder.create({
      data: {
        type: "MEDICATION",
        title: draft.name!,
        description: draft.dosage ? `Dosage: ${draft.dosage}` : null,
        medicationId: medication.id,
        scheduledTime: draft.scheduledTime!,
        recurrence: recurrenceValue,
        daysOfWeek,
        elderlyProfileId,
      },
    });
  });
}

export async function createOrUpdateAssessment(elderlyProfileId: string, draft: DraftPayload): Promise<{ active: boolean }> {
  const questionCount = await prisma.assessmentQuestion.count({
    where: { elderlyProfileId },
  });
  const canActivate = questionCount >= 10;
  await prisma.assessmentConfig.upsert({
    where: { elderlyProfileId },
    create: {
      elderlyProfileId,
      scheduledTime: draft.scheduledTime!,
      questionsPerCall: 4,
      active: canActivate,
    },
    update: {
      scheduledTime: draft.scheduledTime!,
      active: canActivate,
    },
  });
  return { active: canActivate };
}
