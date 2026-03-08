import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { parseCareCommand, transcribeAudio, type ParsedCareCommand } from "@/lib/gemini";
import {
  sendMessage, answerCallbackQuery, editMessageText, downloadFile,
  buildProfileKeyboard, buildConfirmKeyboard, buildPaginationKeyboard, buildItemKeyboard,
  type InlineKeyboardMarkup,
} from "@/lib/telegram-api";
import {
  type DraftPayload, type ConversationState, type MissingField, type ProfileOption,
  normalizePhone, detectCancel, cleanString, normalizeRecurrence,
  fieldPrompt, getMissingFields, mergeDraftWithMessage, findProfileByName,
  createCustomReminder, createMedicationWithReminder, createOrUpdateAssessment,
} from "@/lib/messaging-common";

// ---------------------------------------------------------------------------
// Telegram Update types (defined inline)
// ---------------------------------------------------------------------------

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

interface TelegramMessage {
  message_id: number;
  from?: { id: number; first_name: string; last_name?: string };
  chat: { id: number };
  text?: string;
  voice?: { file_id: string; mime_type?: string; duration: number };
  audio?: { file_id: string; mime_type?: string };
}

interface TelegramCallbackQuery {
  id: string;
  from: { id: number };
  message?: { message_id: number; chat: { id: number } };
  data?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 5;

type ActiveIntent = "REMINDER" | "MEDICATION" | "ASSESSMENT" | "VIEW" | "EDIT" | "DELETE";

// ---------------------------------------------------------------------------
// Extended conversation state for edit/delete flows
// ---------------------------------------------------------------------------

interface TelegramConversationState extends ConversationState {
  editItemId?: string;
  editItemType?: string;
  editChanges?: Record<string, string>;
  deleteItemId?: string;
  deleteItemType?: string;
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function parseState(raw: Prisma.JsonValue | null): TelegramConversationState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as unknown as TelegramConversationState;
}

async function getConversation(chatId: string, userId: string) {
  return prisma.telegramConversation.upsert({
    where: { telegramChatId: chatId },
    create: {
      telegramChatId: chatId,
      telegramUserId: userId,
      intent: "NONE",
    },
    update: {},
  });
}

async function resetConversation(conversationId: string, response: string): Promise<void> {
  await prisma.telegramConversation.update({
    where: { id: conversationId },
    data: {
      intent: "NONE",
      state: Prisma.DbNull,
      lastAssistantMessage: response,
    },
  });
}

async function getCaregiverProfiles(caregiverId: string): Promise<ProfileOption[]> {
  // A caregiver row maps to one elderly profile, but the same user may
  // have multiple caregiver rows (one per profile).  We find all caregiver
  // rows that share the same userId (or phone) to collect all profiles.
  const caregiver = await prisma.caregiver.findUnique({ where: { id: caregiverId } });
  if (!caregiver) return [];

  const siblings = await prisma.caregiver.findMany({
    where: {
      OR: [
        { id: caregiverId },
        ...(caregiver.userId ? [{ userId: caregiver.userId }] : []),
        { phone: caregiver.phone },
      ],
    },
    include: { elderlyProfile: { select: { id: true, name: true } } },
  });

  const seen = new Set<string>();
  const profiles: ProfileOption[] = [];
  for (const cg of siblings) {
    if (seen.has(cg.elderlyProfileId)) continue;
    seen.add(cg.elderlyProfileId);
    profiles.push({ id: cg.elderlyProfile.id, name: cg.elderlyProfile.name });
  }
  return profiles;
}

function formatReminder(r: { id: string; title: string; scheduledTime: string; recurrence: string; active: boolean; description?: string | null }): string {
  const status = r.active ? "Active" : "Paused";
  return `*${r.title}* — ${r.scheduledTime} (${r.recurrence}) [${status}]${r.description ? `\n  _${r.description}_` : ""}`;
}

function formatMedication(m: { id: string; name: string; dosage?: string | null; instructions?: string | null }): string {
  let line = `*${m.name}*`;
  if (m.dosage) line += ` — ${m.dosage}`;
  if (m.instructions) line += `\n  _${m.instructions}_`;
  return line;
}

// ---------------------------------------------------------------------------
// View handler
// ---------------------------------------------------------------------------

async function handleView(chatId: string, elderlyProfileId: string, viewTarget: string, page: number = 0): Promise<void> {
  if (viewTarget === "reminders") {
    const total = await prisma.reminder.count({ where: { elderlyProfileId } });
    const reminders = await prisma.reminder.findMany({
      where: { elderlyProfileId },
      orderBy: { createdAt: "desc" },
      skip: page * PAGE_SIZE,
      take: PAGE_SIZE,
    });
    if (total === 0) {
      await sendMessage(chatId, "No reminders found for this profile.");
      return;
    }
    const totalPages = Math.ceil(total / PAGE_SIZE);
    const lines = reminders.map((r, i) => `${page * PAGE_SIZE + i + 1}. ${formatReminder(r)}`);
    let text = `*Reminders* (page ${page + 1}/${totalPages}):\n\n${lines.join("\n\n")}`;
    const keyboard = totalPages > 1 ? buildPaginationKeyboard(page, totalPages, "reminders") : undefined;
    await sendMessage(chatId, text, keyboard);

  } else if (viewTarget === "medications") {
    const medications = await prisma.medication.findMany({
      where: { elderlyProfileId },
      orderBy: { createdAt: "desc" },
    });
    if (medications.length === 0) {
      await sendMessage(chatId, "No medications found for this profile.");
      return;
    }
    const lines = medications.map((m, i) => `${i + 1}. ${formatMedication(m)}`);
    await sendMessage(chatId, `*Medications*:\n\n${lines.join("\n\n")}`);

  } else if (viewTarget === "assessments") {
    const sessions = await prisma.assessmentSession.findMany({
      where: { elderlyProfileId },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    if (sessions.length === 0) {
      await sendMessage(chatId, "No assessment sessions found for this profile.");
      return;
    }
    const lines = sessions.map((s) => {
      const score = s.overallScore != null ? `${Math.round(s.overallScore * 100)}%` : "N/A";
      const severity = s.severity || "N/A";
      return `- *${s.date}* — Score: ${score}, Severity: ${severity}, Status: ${s.status}`;
    });
    await sendMessage(chatId, `*Recent Assessments*:\n\n${lines.join("\n")}`);

  } else if (viewTarget === "logs") {
    const logs = await prisma.reminderLog.findMany({
      where: { reminder: { elderlyProfileId } },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { reminder: { select: { title: true } } },
    });
    if (logs.length === 0) {
      await sendMessage(chatId, "No call logs found for this profile.");
      return;
    }
    const lines = logs.map((l) => {
      const time = l.calledAt ? l.calledAt.toLocaleString() : l.createdAt.toLocaleString();
      return `- *${l.reminder.title}* — ${l.status} at ${time}`;
    });
    await sendMessage(chatId, `*Recent Call Logs*:\n\n${lines.join("\n")}`);

  } else {
    await sendMessage(chatId, "I can show: reminders, medications, assessments, or logs. Which would you like?");
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function handleTelegramUpdate(update: TelegramUpdate): Promise<void> {
  // Route to callback query handler
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
    return;
  }

  const message = update.message;
  if (!message) return;

  const chatId = String(message.chat.id);
  const userId = String(message.from?.id || message.chat.id);

  // Handle voice messages
  if (message.voice || message.audio) {
    const fileId = message.voice?.file_id || message.audio?.file_id;
    const mimeType = message.voice?.mime_type || message.audio?.mime_type || "audio/ogg";
    if (!fileId) return;

    try {
      const audioBuffer = await downloadFile(fileId);
      const text = await transcribeAudio(audioBuffer, mimeType);
      if (text === "UNCLEAR" || !text.trim()) {
        await sendMessage(chatId, "I couldn't understand the voice message. Please try again or type your request.");
        return;
      }
      // Process transcribed text as a regular message
      await handleTextMessage(chatId, userId, text.trim());
    } catch (err) {
      console.error("Telegram voice processing error:", err);
      await sendMessage(chatId, "Sorry, I had trouble processing that voice message. Please try typing your request.");
    }
    return;
  }

  const text = message.text?.trim();
  if (!text) return;

  // Handle /start command
  if (text.startsWith("/start")) {
    await handleStartCommand(chatId, userId, text);
    return;
  }

  // Handle /cancel command
  if (text === "/cancel") {
    const conversation = await getConversation(chatId, userId);
    await resetConversation(conversation.id, "Cancelled. Send a new message anytime.");
    await sendMessage(chatId, "Cancelled. Send a new message anytime.");
    return;
  }

  await handleTextMessage(chatId, userId, text);
}

// ---------------------------------------------------------------------------
// /start command
// ---------------------------------------------------------------------------

async function handleStartCommand(chatId: string, userId: string, text: string): Promise<void> {
  const parts = text.split(/\s+/);
  const linkCode = parts.length > 1 ? parts.slice(1).join("") : null;

  if (!linkCode) {
    await sendMessage(
      chatId,
      "Welcome to Seniora AI! To link your account, use a link code from the website:\n\n" +
      "/start <code>\n\n" +
      "Or send your registered phone number to connect."
    );
    return;
  }

  // Look up caregiver by linkCode
  const caregiver = await prisma.caregiver.findFirst({
    where: {
      linkCode,
      linkCodeExpiresAt: { gt: new Date() },
    },
    include: {
      elderlyProfile: { select: { id: true, name: true } },
    },
  });

  if (!caregiver) {
    await sendMessage(chatId, "Invalid or expired link code. Please generate a new one from the website.");
    return;
  }

  // Link the caregiver
  await prisma.caregiver.update({
    where: { id: caregiver.id },
    data: {
      telegramChatId: chatId,
      linkCode: null,
      linkCodeExpiresAt: null,
    },
  });

  // Update or create conversation with caregiver link
  await prisma.telegramConversation.upsert({
    where: { telegramChatId: chatId },
    create: {
      telegramChatId: chatId,
      telegramUserId: userId,
      caregiverId: caregiver.id,
      elderlyProfileId: caregiver.elderlyProfileId,
      intent: "NONE",
    },
    update: {
      caregiverId: caregiver.id,
      elderlyProfileId: caregiver.elderlyProfileId,
    },
  });

  await sendMessage(
    chatId,
    `Linked! You're connected as *${caregiver.name}* for *${caregiver.elderlyProfile.name}*. ` +
    "Send me a message to manage reminders, medications, or assessments."
  );
}

// ---------------------------------------------------------------------------
// Text message handler
// ---------------------------------------------------------------------------

async function handleTextMessage(chatId: string, userId: string, incomingMessage: string): Promise<void> {
  const conversation = await getConversation(chatId, userId);

  // Update last user message
  await prisma.telegramConversation.update({
    where: { id: conversation.id },
    data: { lastUserMessage: incomingMessage },
  });

  // Check if caregiver is linked
  if (!conversation.caregiverId) {
    // Try phone number matching
    const normalized = normalizePhone(incomingMessage);
    if (normalized) {
      const caregiver = await prisma.caregiver.findFirst({
        where: {
          OR: [
            { phone: normalized },
            { phone: { endsWith: normalized.replace(/^\+1/, "") } },
          ],
        },
        include: { elderlyProfile: { select: { id: true, name: true } } },
      });

      if (caregiver) {
        await prisma.telegramConversation.update({
          where: { id: conversation.id },
          data: {
            caregiverId: caregiver.id,
            elderlyProfileId: caregiver.elderlyProfileId,
          },
        });
        await prisma.caregiver.update({
          where: { id: caregiver.id },
          data: { telegramChatId: chatId },
        });
        const msg = `Linked! You're connected as *${caregiver.name}* for *${caregiver.elderlyProfile.name}*. Send me a message to manage reminders, medications, or assessments.`;
        await prisma.telegramConversation.update({
          where: { id: conversation.id },
          data: { lastAssistantMessage: msg },
        });
        await sendMessage(chatId, msg);
        return;
      }
    }

    await sendMessage(chatId, "Please link your account first. Use /start <code> or send your registered phone number.");
    return;
  }

  let state = parseState(conversation.state);
  let intent = conversation.intent;
  let elderlyProfileId = conversation.elderlyProfileId;

  // If no elderlyProfileId, resolve from caregiver profiles
  if (!elderlyProfileId) {
    const profiles = await getCaregiverProfiles(conversation.caregiverId);
    if (profiles.length === 0) {
      await sendMessage(chatId, "No elderly profiles found for your account.");
      return;
    }
    if (profiles.length === 1) {
      elderlyProfileId = profiles[0].id;
      await prisma.telegramConversation.update({
        where: { id: conversation.id },
        data: { elderlyProfileId },
      });
    } else {
      // Save pending profile options and show keyboard
      state = { ...state, pendingProfileOptions: profiles };
      await prisma.telegramConversation.update({
        where: { id: conversation.id },
        data: {
          state: state as unknown as Prisma.InputJsonValue,
          lastAssistantMessage: "Which elderly profile is this for?",
        },
      });
      await sendMessage(chatId, "Which elderly profile is this for?", buildProfileKeyboard(profiles));
      return;
    }
  }

  // Handle pending profile selection via text fallback
  if (state.pendingProfileOptions && state.pendingProfileOptions.length > 0 && !elderlyProfileId) {
    const match = findProfileByName(state.pendingProfileOptions, incomingMessage);
    if (match) {
      elderlyProfileId = match.id;
      state = { ...state, pendingProfileOptions: undefined };
      await prisma.telegramConversation.update({
        where: { id: conversation.id },
        data: { elderlyProfileId },
      });
    } else {
      await sendMessage(chatId, "Please select a profile from the options above, or type the name.");
      return;
    }
  }

  // Detect cancel
  if (detectCancel(incomingMessage)) {
    const msg = "Cancelled. Send a new message anytime.";
    await resetConversation(conversation.id, msg);
    await sendMessage(chatId, msg);
    return;
  }

  // Parse intent via Gemini
  let parsed: ParsedCareCommand = {
    intent: "UNKNOWN",
    elderlyName: null,
    title: null,
    description: null,
    name: null,
    dosage: null,
    instructions: null,
    scheduledTime: null,
    scheduledDate: null,
    recurrence: null,
    daysOfWeek: null,
    leadTimeMinutes: null,
  };

  try {
    parsed = await parseCareCommand({
      message: incomingMessage,
      pendingIntent: intent === "NONE" ? undefined : intent,
    });
  } catch (err) {
    console.error("Gemini parse error:", err);
  }

  if (parsed.intent === "CANCEL") {
    const msg = "Cancelled. Send a new message anytime.";
    await resetConversation(conversation.id, msg);
    await sendMessage(chatId, msg);
    return;
  }

  // Determine active intent
  const parsedIntent = mapIntent(parsed.intent);

  if (intent === "NONE") {
    if (!parsedIntent) {
      const msg = "Tell me what to do: create a reminder, add a medication, schedule an assessment, view items, edit, or delete. For example: _Set medication Aspirin at 8:00 AM_";
      await prisma.telegramConversation.update({
        where: { id: conversation.id },
        data: { lastAssistantMessage: msg },
      });
      await sendMessage(chatId, msg);
      return;
    }
    intent = parsedIntent;
    state = {};
  } else if (parsedIntent && parsedIntent !== intent) {
    intent = parsedIntent;
    state = {};
  }

  // Route by intent
  if (intent === "VIEW") {
    const viewTarget = parsed.viewTarget || "reminders";
    await handleView(chatId, elderlyProfileId!, viewTarget);
    await prisma.telegramConversation.update({
      where: { id: conversation.id },
      data: { intent: "NONE", state: Prisma.DbNull },
    });
    return;
  }

  if (intent === "EDIT") {
    await handleEdit(chatId, conversation.id, elderlyProfileId!, parsed, state, incomingMessage);
    return;
  }

  if (intent === "DELETE") {
    await handleDelete(chatId, conversation.id, elderlyProfileId!, parsed, state, incomingMessage);
    return;
  }

  // CREATE flows: REMINDER, MEDICATION, ASSESSMENT
  await handleCreateFlow(chatId, conversation.id, elderlyProfileId!, intent, parsed, state, incomingMessage);
}

// ---------------------------------------------------------------------------
// Intent mapper
// ---------------------------------------------------------------------------

function mapIntent(intent: string): ActiveIntent | null {
  const valid: ActiveIntent[] = ["REMINDER", "MEDICATION", "ASSESSMENT", "VIEW", "EDIT", "DELETE"];
  return valid.includes(intent as ActiveIntent) ? (intent as ActiveIntent) : null;
}

// ---------------------------------------------------------------------------
// Create flow (REMINDER / MEDICATION / ASSESSMENT)
// ---------------------------------------------------------------------------

async function handleCreateFlow(
  chatId: string,
  conversationId: string,
  elderlyProfileId: string,
  intent: string,
  parsed: ParsedCareCommand,
  existingState: TelegramConversationState,
  incomingMessage: string
): Promise<void> {
  const state = existingState;
  const draft: DraftPayload = { ...(state.draft || {}) };

  // Extract fields from parsed result
  if (intent === "REMINDER") {
    const title = cleanString(parsed.title);
    if (title) draft.title = title;
    const description = cleanString(parsed.description);
    if (description) draft.description = description;
  }

  if (intent === "MEDICATION") {
    const name = cleanString(parsed.name);
    if (name) draft.name = name;
    const dosage = cleanString(parsed.dosage);
    if (dosage) draft.dosage = dosage;
    const instructions = cleanString(parsed.instructions);
    if (instructions) draft.instructions = instructions;
  }

  const scheduledTime = cleanString(parsed.scheduledTime);
  if (scheduledTime) draft.scheduledTime = scheduledTime;
  const scheduledDate = cleanString(parsed.scheduledDate);
  if (scheduledDate) draft.scheduledDate = scheduledDate;
  const recurrence = normalizeRecurrence(parsed.recurrence);
  if (recurrence) draft.recurrence = recurrence;

  if (Array.isArray(parsed.daysOfWeek) && parsed.daysOfWeek.length > 0) {
    draft.daysOfWeek = Array.from(
      new Set(parsed.daysOfWeek.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))
    ).sort((a, b) => a - b);
  }

  if (typeof parsed.leadTimeMinutes === "number" && parsed.leadTimeMinutes >= 0) {
    draft.leadTimeMinutes = Math.floor(parsed.leadTimeMinutes);
  }

  mergeDraftWithMessage(intent, draft, incomingMessage);

  // Fill from previous missing field prompts
  const previousMissing = state.missingFields || [];
  if (previousMissing.includes("title") && !draft.title) draft.title = incomingMessage;
  if (previousMissing.includes("name") && !draft.name) draft.name = incomingMessage;

  const missingFields = getMissingFields(intent, draft);

  if (missingFields.length > 0) {
    const prompt = fieldPrompt(intent, missingFields[0]);
    await prisma.telegramConversation.update({
      where: { id: conversationId },
      data: {
        intent,
        state: { draft, missingFields } as unknown as Prisma.InputJsonValue,
        lastAssistantMessage: prompt,
      },
    });
    await sendMessage(chatId, prompt);
    return;
  }

  // All fields present — execute creation
  const profile = await prisma.elderlyProfile.findUnique({
    where: { id: elderlyProfileId },
    select: { name: true },
  });
  const profileName = profile?.name || "the profile";

  let confirmMsg: string;

  if (intent === "REMINDER") {
    await createCustomReminder(elderlyProfileId, draft);
    confirmMsg = `Done! Reminder *${draft.title}* for *${profileName}* at ${draft.scheduledTime} has been created.`;
  } else if (intent === "MEDICATION") {
    await createMedicationWithReminder(elderlyProfileId, draft);
    confirmMsg = `Done! Medication *${draft.name}* for *${profileName}* with reminders at ${draft.scheduledTime} has been created.`;
  } else {
    const { active } = await createOrUpdateAssessment(elderlyProfileId, draft);
    confirmMsg = active
      ? `Done! Assessment for *${profileName}* scheduled at ${draft.scheduledTime}. It is active now.`
      : `Assessment time for *${profileName}* set to ${draft.scheduledTime}, but activation needs at least 10 questions.`;
  }

  await resetConversation(conversationId, confirmMsg);
  await sendMessage(chatId, confirmMsg);
}

// ---------------------------------------------------------------------------
// Edit flow
// ---------------------------------------------------------------------------

async function handleEdit(
  chatId: string,
  conversationId: string,
  elderlyProfileId: string,
  parsed: ParsedCareCommand,
  state: TelegramConversationState,
  incomingMessage: string
): Promise<void> {
  // If we already have an item selected and are waiting for changes
  if (state.editItemId && state.editItemType) {
    // If we already have pending changes, this is a confirmation flow handled by callback
    if (state.editChanges && Object.keys(state.editChanges).length > 0) {
      // User typed something instead of using the keyboard — parse as new changes
    }

    // Parse the user's message for edit fields
    let editChanges: Record<string, string> = {};
    try {
      const editParsed = await parseCareCommand({ message: incomingMessage, pendingIntent: "EDIT" });
      if (editParsed.editFields) {
        editChanges = editParsed.editFields;
      }
      // Also extract common fields
      if (editParsed.scheduledTime) editChanges.scheduledTime = editParsed.scheduledTime;
      if (editParsed.title) editChanges.title = editParsed.title;
      if (editParsed.name) editChanges.name = editParsed.name;
      if (editParsed.dosage) editChanges.dosage = editParsed.dosage;
      if (editParsed.recurrence) editChanges.recurrence = editParsed.recurrence;
    } catch {
      // Fallback: treat the whole message as a description of changes
    }

    if (Object.keys(editChanges).length === 0) {
      // Try to extract time or other simple patterns from the message
      const { parseTimeFromText } = await import("@/lib/messaging-common");
      const time = parseTimeFromText(incomingMessage);
      if (time) editChanges.scheduledTime = time;
    }

    if (Object.keys(editChanges).length === 0) {
      await sendMessage(chatId, "I couldn't understand what to change. Please describe the edit, e.g. _change time to 9:00 AM_ or _update dosage to 200mg_.");
      return;
    }

    // Show confirmation
    const changeDesc = Object.entries(editChanges).map(([k, v]) => `- ${k}: ${v}`).join("\n");
    const confirmMsg = `Apply these changes?\n\n${changeDesc}`;

    await prisma.telegramConversation.update({
      where: { id: conversationId },
      data: {
        state: {
          ...state,
          editChanges,
        } as unknown as Prisma.InputJsonValue,
        lastAssistantMessage: confirmMsg,
      },
    });

    const keyboard = buildConfirmKeyboard("edit", `${state.editItemType}:${state.editItemId}`);
    await sendMessage(chatId, confirmMsg, keyboard);
    return;
  }

  // Find matching items
  const target = cleanString(parsed.editTarget) || cleanString(parsed.deleteTarget) || incomingMessage;

  // Search reminders
  const reminders = await prisma.reminder.findMany({
    where: {
      elderlyProfileId,
      title: { contains: target, mode: "insensitive" },
    },
  });

  // Search medications
  const medications = await prisma.medication.findMany({
    where: {
      elderlyProfileId,
      name: { contains: target, mode: "insensitive" },
    },
  });

  const items = [
    ...reminders.map((r) => ({ id: r.id, type: "reminder", label: `${r.title} (${r.scheduledTime})` })),
    ...medications.map((m) => ({ id: m.id, type: "medication", label: `${m.name}${m.dosage ? ` — ${m.dosage}` : ""}` })),
  ];

  if (items.length === 0) {
    const msg = "I couldn't find any matching items to edit. Please try again with a more specific name.";
    await resetConversation(conversationId, msg);
    await sendMessage(chatId, msg);
    return;
  }

  if (items.length === 1) {
    const item = items[0];
    const detailMsg = `Found *${item.label}*. What would you like to change?`;
    await prisma.telegramConversation.update({
      where: { id: conversationId },
      data: {
        intent: "EDIT",
        state: {
          editItemId: item.id,
          editItemType: item.type,
        } as unknown as Prisma.InputJsonValue,
        lastAssistantMessage: detailMsg,
      },
    });
    await sendMessage(chatId, detailMsg);
    return;
  }

  // Multiple matches — show selection keyboard
  const keyboard = buildItemKeyboard(
    items.map((i) => ({ id: `${i.type}:${i.id}`, label: i.label })),
    "select_edit"
  );
  const msg = "Multiple items found. Which one would you like to edit?";
  await prisma.telegramConversation.update({
    where: { id: conversationId },
    data: {
      intent: "EDIT",
      state: {} as unknown as Prisma.InputJsonValue,
      lastAssistantMessage: msg,
    },
  });
  await sendMessage(chatId, msg, keyboard);
}

// ---------------------------------------------------------------------------
// Delete flow
// ---------------------------------------------------------------------------

async function handleDelete(
  chatId: string,
  conversationId: string,
  elderlyProfileId: string,
  parsed: ParsedCareCommand,
  state: TelegramConversationState,
  incomingMessage: string
): Promise<void> {
  // If already have a target, this shouldn't happen (confirmation via keyboard)
  if (state.deleteItemId && state.deleteItemType) {
    // User typed instead of using keyboard — show confirmation again
    const keyboard = buildConfirmKeyboard("delete", `${state.deleteItemType}:${state.deleteItemId}`);
    await sendMessage(chatId, "Please confirm the deletion using the buttons above.", keyboard);
    return;
  }

  const target = cleanString(parsed.deleteTarget) || cleanString(parsed.editTarget) || incomingMessage;

  const reminders = await prisma.reminder.findMany({
    where: {
      elderlyProfileId,
      title: { contains: target, mode: "insensitive" },
    },
  });

  const medications = await prisma.medication.findMany({
    where: {
      elderlyProfileId,
      name: { contains: target, mode: "insensitive" },
    },
  });

  const items = [
    ...reminders.map((r) => ({ id: r.id, type: "reminder", label: `${r.title} (${r.scheduledTime})` })),
    ...medications.map((m) => ({ id: m.id, type: "medication", label: `${m.name}${m.dosage ? ` — ${m.dosage}` : ""}` })),
  ];

  if (items.length === 0) {
    const msg = "I couldn't find any matching items to delete. Please try again with a more specific name.";
    await resetConversation(conversationId, msg);
    await sendMessage(chatId, msg);
    return;
  }

  if (items.length === 1) {
    const item = items[0];
    const msg = `Delete *${item.label}*? This cannot be undone.`;
    await prisma.telegramConversation.update({
      where: { id: conversationId },
      data: {
        intent: "DELETE",
        state: {
          deleteItemId: item.id,
          deleteItemType: item.type,
        } as unknown as Prisma.InputJsonValue,
        lastAssistantMessage: msg,
      },
    });
    const keyboard = buildConfirmKeyboard("delete", `${item.type}:${item.id}`);
    await sendMessage(chatId, msg, keyboard);
    return;
  }

  // Multiple matches
  const keyboard = buildItemKeyboard(
    items.map((i) => ({ id: `${i.type}:${i.id}`, label: i.label })),
    "select_delete"
  );
  const msg = "Multiple items found. Which one would you like to delete?";
  await prisma.telegramConversation.update({
    where: { id: conversationId },
    data: {
      intent: "DELETE",
      state: {} as unknown as Prisma.InputJsonValue,
      lastAssistantMessage: msg,
    },
  });
  await sendMessage(chatId, msg, keyboard);
}

// ---------------------------------------------------------------------------
// Callback query handler
// ---------------------------------------------------------------------------

async function handleCallbackQuery(query: TelegramCallbackQuery): Promise<void> {
  await answerCallbackQuery(query.id);

  const data = query.data;
  if (!data || !query.message) return;

  const chatId = String(query.message.chat.id);
  const userId = String(query.from.id);
  const conversation = await getConversation(chatId, userId);

  // Profile selection
  if (data.startsWith("profile:")) {
    const profileId = data.replace("profile:", "");
    await prisma.telegramConversation.update({
      where: { id: conversation.id },
      data: {
        elderlyProfileId: profileId,
        state: Prisma.DbNull,
      },
    });
    const profile = await prisma.elderlyProfile.findUnique({
      where: { id: profileId },
      select: { name: true },
    });
    const msg = `Selected *${profile?.name || "profile"}*. Now send me your request.`;
    await editMessageText(chatId, query.message.message_id, msg);
    await prisma.telegramConversation.update({
      where: { id: conversation.id },
      data: { lastAssistantMessage: msg },
    });
    return;
  }

  // Cancel action
  if (data === "cancel_action") {
    const msg = "Cancelled.";
    await resetConversation(conversation.id, msg);
    await editMessageText(chatId, query.message.message_id, msg);
    return;
  }

  // Confirm delete
  if (data.startsWith("confirm_delete:")) {
    const payload = data.replace("confirm_delete:", "");
    const [type, id] = payload.split(":");

    try {
      if (type === "reminder") {
        await prisma.reminder.delete({ where: { id } });
      } else if (type === "medication") {
        // Also delete associated reminders
        await prisma.reminder.deleteMany({ where: { medicationId: id } });
        await prisma.medication.delete({ where: { id } });
      }
      const msg = `Deleted successfully.`;
      await resetConversation(conversation.id, msg);
      await editMessageText(chatId, query.message.message_id, msg);
    } catch (err) {
      console.error("Delete error:", err);
      const msg = "Failed to delete. The item may have already been removed.";
      await resetConversation(conversation.id, msg);
      await editMessageText(chatId, query.message.message_id, msg);
    }
    return;
  }

  // Confirm edit
  if (data.startsWith("confirm_edit:")) {
    const payload = data.replace("confirm_edit:", "");
    const [type, id] = payload.split(":");
    const state = parseState(conversation.state);
    const changes = state.editChanges || {};

    try {
      if (type === "reminder") {
        const updateData: Record<string, unknown> = {};
        if (changes.title) updateData.title = changes.title;
        if (changes.scheduledTime) updateData.scheduledTime = changes.scheduledTime;
        if (changes.description) updateData.description = changes.description;
        if (changes.recurrence) {
          const rec = normalizeRecurrence(changes.recurrence);
          if (rec) updateData.recurrence = rec;
        }
        if (changes.active !== undefined) updateData.active = changes.active === "true";
        await prisma.reminder.update({ where: { id }, data: updateData });
      } else if (type === "medication") {
        const updateData: Record<string, unknown> = {};
        if (changes.name) updateData.name = changes.name;
        if (changes.dosage) updateData.dosage = changes.dosage;
        if (changes.instructions) updateData.instructions = changes.instructions;
        await prisma.medication.update({ where: { id }, data: updateData });

        // Also update associated reminder time if provided
        if (changes.scheduledTime) {
          await prisma.reminder.updateMany({
            where: { medicationId: id },
            data: { scheduledTime: changes.scheduledTime },
          });
        }
      }

      const msg = "Updated successfully.";
      await resetConversation(conversation.id, msg);
      await editMessageText(chatId, query.message.message_id, msg);
    } catch (err) {
      console.error("Edit error:", err);
      const msg = "Failed to update. Please try again.";
      await resetConversation(conversation.id, msg);
      await editMessageText(chatId, query.message.message_id, msg);
    }
    return;
  }

  // Select item for editing
  if (data.startsWith("select_edit:")) {
    const payload = data.replace("select_edit:", "");
    const [type, id] = payload.split(":");

    let detailMsg = "";
    if (type === "reminder") {
      const r = await prisma.reminder.findUnique({ where: { id } });
      if (r) {
        detailMsg = `*${r.title}*\nTime: ${r.scheduledTime}\nRecurrence: ${r.recurrence}\nActive: ${r.active}\n\nWhat would you like to change?`;
      }
    } else if (type === "medication") {
      const m = await prisma.medication.findUnique({ where: { id } });
      if (m) {
        detailMsg = `*${m.name}*\nDosage: ${m.dosage || "N/A"}\nInstructions: ${m.instructions || "N/A"}\n\nWhat would you like to change?`;
      }
    }

    if (!detailMsg) {
      detailMsg = "Item not found. It may have been deleted.";
      await resetConversation(conversation.id, detailMsg);
      await editMessageText(chatId, query.message.message_id, detailMsg);
      return;
    }

    await prisma.telegramConversation.update({
      where: { id: conversation.id },
      data: {
        intent: "EDIT",
        state: {
          editItemId: id,
          editItemType: type,
        } as unknown as Prisma.InputJsonValue,
        lastAssistantMessage: detailMsg,
      },
    });
    await editMessageText(chatId, query.message.message_id, detailMsg);
    return;
  }

  // Select item for deletion
  if (data.startsWith("select_delete:")) {
    const payload = data.replace("select_delete:", "");
    const [type, id] = payload.split(":");

    let label = "";
    if (type === "reminder") {
      const r = await prisma.reminder.findUnique({ where: { id } });
      if (r) label = `${r.title} (${r.scheduledTime})`;
    } else if (type === "medication") {
      const m = await prisma.medication.findUnique({ where: { id } });
      if (m) label = `${m.name}${m.dosage ? ` — ${m.dosage}` : ""}`;
    }

    if (!label) {
      const msg = "Item not found. It may have been deleted.";
      await resetConversation(conversation.id, msg);
      await editMessageText(chatId, query.message.message_id, msg);
      return;
    }

    const msg = `Delete *${label}*? This cannot be undone.`;
    await prisma.telegramConversation.update({
      where: { id: conversation.id },
      data: {
        intent: "DELETE",
        state: {
          deleteItemId: id,
          deleteItemType: type,
        } as unknown as Prisma.InputJsonValue,
        lastAssistantMessage: msg,
      },
    });

    const keyboard = buildConfirmKeyboard("delete", `${type}:${id}`);
    await editMessageText(chatId, query.message.message_id, msg, keyboard);
    return;
  }

  // Pagination
  if (data.startsWith("page:")) {
    const parts = data.split(":");
    const entity = parts[1];
    const pageNum = parseInt(parts[2], 10) || 0;

    if (conversation.elderlyProfileId) {
      await handleView(chatId, conversation.elderlyProfileId, entity, pageNum);
    }
    return;
  }
}
