import { Prisma } from "@/generated/prisma";
import type { WhatsAppIntent } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import {
  parseWhatsAppCareCommand,
  transcribeAudio,
  type WhatsAppParsedCommand,
  type WhatsAppIntentParse,
} from "@/lib/gemini";
import {
  type MissingField,
  type ProfileOption,
  type DraftPayload,
  type ConversationState,
  normalizePhone,
  normalizeRecurrence,
  cleanString,
  detectCancel,
  fieldPrompt,
  getMissingFields,
  mergeDraftWithMessage,
  findProfileByName,
  findProfileBySelection,
  listProfiles,
  createCustomReminder,
  createMedicationWithReminder,
  createOrUpdateAssessment,
} from "@/lib/messaging-common";

type ActiveIntent = Exclude<WhatsAppIntent, "NONE">;

interface CaregiverLink {
  caregiverId: string;
  caregiverName: string;
  profile: {
    id: string;
    name: string;
  };
}

function parseState(raw: Prisma.JsonValue | null): ConversationState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as unknown as ConversationState;
}

function mapIntent(intent: WhatsAppIntentParse): ActiveIntent | null {
  if (intent === "REMINDER" || intent === "MEDICATION" || intent === "ASSESSMENT") {
    return intent;
  }
  return null;
}

async function findCaregiverLinks(fromPhone: string): Promise<CaregiverLink[]> {
  const digits = fromPhone.replace(/\D/g, "");
  const last10 = digits.slice(-10);

  const candidates = Array.from(
    new Set([
      fromPhone,
      digits,
      `+${digits}`,
      last10,
      `+1${last10}`,
      `1${last10}`,
    ].filter(Boolean))
  );

  const caregivers = await prisma.caregiver.findMany({
    where: {
      OR: [
        ...candidates.map((phone) => ({ phone })),
        ...(last10
          ? [
              { phone: { endsWith: last10 } },
            ]
          : []),
      ],
    },
    include: {
      elderlyProfile: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  const seen = new Set<string>();
  const links: CaregiverLink[] = [];

  for (const cg of caregivers) {
    const key = `${cg.id}:${cg.elderlyProfileId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    links.push({
      caregiverId: cg.id,
      caregiverName: cg.name,
      profile: {
        id: cg.elderlyProfile.id,
        name: cg.elderlyProfile.name,
      },
    });
  }

  return links;
}

async function resetConversation(
  conversationId: string,
  fromPhone: string,
  responseText: string,
  elderlyProfileId?: string,
  caregiverId?: string
): Promise<void> {
  await prisma.whatsAppConversation.update({
    where: { id: conversationId },
    data: {
      fromPhone,
      caregiverPhone: fromPhone,
      caregiverId: caregiverId || null,
      elderlyProfileId: elderlyProfileId || null,
      intent: "NONE",
      state: Prisma.DbNull,
      lastAssistantMessage: responseText,
    },
  });
}

export async function transcribeTwilioWhatsAppAudio(mediaUrl: string): Promise<string> {
  const basic = Buffer.from(
    `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
  ).toString("base64");

  const mediaRes = await fetch(mediaUrl, {
    headers: { Authorization: `Basic ${basic}` },
  });

  if (!mediaRes.ok) {
    throw new Error(`Failed to download WhatsApp media: ${mediaRes.status}`);
  }

  const contentType = mediaRes.headers.get("content-type") || "audio/ogg";
  const audioBuffer = Buffer.from(await mediaRes.arrayBuffer());
  return transcribeAudio(audioBuffer, contentType);
}

export async function transcribeMetaWhatsAppAudio(mediaId: string): Promise<string> {
  const accessToken = process.env.WHATSAPP_CLOUD_ACCESS_TOKEN;
  const apiVersion = process.env.WHATSAPP_CLOUD_API_VERSION || "v23.0";
  if (!accessToken) throw new Error("WHATSAPP_CLOUD_ACCESS_TOKEN is not set");

  const mediaMetaRes = await fetch(`https://graph.facebook.com/${apiVersion}/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!mediaMetaRes.ok) {
    throw new Error(`Failed to fetch Meta media metadata: ${mediaMetaRes.status}`);
  }

  const meta = (await mediaMetaRes.json()) as { url?: string; mime_type?: string };
  if (!meta.url) throw new Error("Meta media URL missing");

  const mediaRes = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!mediaRes.ok) {
    throw new Error(`Failed to download Meta media: ${mediaRes.status}`);
  }

  const contentType = mediaRes.headers.get("content-type") || meta.mime_type || "audio/ogg";
  const audioBuffer = Buffer.from(await mediaRes.arrayBuffer());
  return transcribeAudio(audioBuffer, contentType);
}

export async function sendMetaWhatsAppText(params: {
  to: string;
  text: string;
}): Promise<void> {
  const accessToken = process.env.WHATSAPP_CLOUD_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID;
  const apiVersion = process.env.WHATSAPP_CLOUD_API_VERSION || "v23.0";

  if (!accessToken || !phoneNumberId) {
    throw new Error(
      "WHATSAPP_CLOUD_ACCESS_TOKEN and WHATSAPP_CLOUD_PHONE_NUMBER_ID must be set"
    );
  }

  const response = await fetch(
    `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: params.to,
        type: "text",
        text: { body: params.text.slice(0, 4096) },
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Meta send message failed: ${response.status} ${body}`);
  }
}

export async function handleWhatsAppCaregiverMessage(params: {
  from: string;
  message: string;
}): Promise<string> {
  const fromPhone = normalizePhone(params.from);
  const incomingMessage = params.message.trim();

  if (!fromPhone) {
    return "I couldn't identify your phone number. Please send from your registered caregiver WhatsApp number.";
  }

  const caregiverLinks = await findCaregiverLinks(fromPhone);
  if (caregiverLinks.length === 0) {
    return "This WhatsApp number is not linked to a caregiver profile yet. Add this number on the caregiver section of the website first.";
  }

  const conversation = await prisma.whatsAppConversation.upsert({
    where: { fromPhone },
    create: {
      fromPhone,
      caregiverPhone: fromPhone,
      caregiverId: caregiverLinks[0]?.caregiverId || null,
      intent: "NONE",
      lastUserMessage: incomingMessage,
    },
    update: {
      caregiverPhone: fromPhone,
      lastUserMessage: incomingMessage,
    },
  });

  if (detectCancel(incomingMessage)) {
    const message = "Okay, I cleared the current WhatsApp task. Send a new request any time.";
    await resetConversation(conversation.id, fromPhone, message);
    return message;
  }

  let state = parseState(conversation.state);
  let intent = conversation.intent;
  let selectedProfileId = conversation.elderlyProfileId;

  const profileOptions: ProfileOption[] = Array.from(
    new Map(caregiverLinks.map((x) => [x.profile.id, x.profile])).values()
  );

  if (selectedProfileId && !profileOptions.some((p) => p.id === selectedProfileId)) {
    selectedProfileId = null;
  }

  if (state.pendingProfileOptions && state.pendingProfileOptions.length > 0 && !selectedProfileId) {
    const selected = findProfileBySelection(state.pendingProfileOptions, incomingMessage);
    if (!selected) {
      const message = `Please choose one profile by number or name:\n${listProfiles(
        state.pendingProfileOptions
      )}`;
      await prisma.whatsAppConversation.update({
        where: { id: conversation.id },
        data: { lastAssistantMessage: message },
      });
      return message;
    }

    selectedProfileId = selected.id;
    state = { ...state, pendingProfileOptions: undefined };
  }

  let parsed: WhatsAppParsedCommand = {
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
    parsed = await parseWhatsAppCareCommand({
      message: incomingMessage,
      pendingIntent: intent === "NONE" ? undefined : (intent as ActiveIntent),
    });
  } catch {
    // Keep fallback payload when Gemini parsing fails.
  }

  if (parsed.intent === "CANCEL") {
    const message = "Okay, I cleared the current WhatsApp task. Send a new request any time.";
    await resetConversation(conversation.id, fromPhone, message, selectedProfileId || undefined);
    return message;
  }

  const parsedIntent = mapIntent(parsed.intent);
  if (intent === "NONE") {
    if (!parsedIntent) {
      const message =
        "Tell me what to set: reminder, medication, or assessment time. Example: 'Set medication Aspirin at 8:00 AM for John'.";
      await prisma.whatsAppConversation.update({
        where: { id: conversation.id },
        data: {
          state: Prisma.DbNull,
          lastAssistantMessage: message,
        },
      });
      return message;
    }
    intent = parsedIntent;
    state = {};
  } else if (parsedIntent && parsedIntent !== intent) {
    // User started a new task while another one was in progress.
    intent = parsedIntent;
    state = {};
  }

  if (!selectedProfileId) {
    if (profileOptions.length === 1) {
      selectedProfileId = profileOptions[0].id;
    } else {
      const matched = findProfileByName(profileOptions, parsed.elderlyName);
      if (matched) {
        selectedProfileId = matched.id;
      } else {
        const message = `Which elderly profile is this for? Reply with number or name:\n${listProfiles(
          profileOptions
        )}`;
        await prisma.whatsAppConversation.update({
          where: { id: conversation.id },
          data: {
            intent,
            state: {
              ...(state as object),
              pendingProfileOptions: profileOptions,
            } as unknown as Prisma.InputJsonValue,
            lastAssistantMessage: message,
          },
        });
        return message;
      }
    }
  }

  const draft: DraftPayload = {
    ...(state.draft || {}),
  };

  if (parsedIntent === "REMINDER" || intent === "REMINDER") {
    const title = cleanString(parsed.title);
    if (title) draft.title = title;

    const description = cleanString(parsed.description);
    if (description) draft.description = description;
  }

  if (parsedIntent === "MEDICATION" || intent === "MEDICATION") {
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
      new Set(parsed.daysOfWeek.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))
    ).sort((a, b) => a - b);
  }

  if (typeof parsed.leadTimeMinutes === "number" && parsed.leadTimeMinutes >= 0) {
    draft.leadTimeMinutes = Math.floor(parsed.leadTimeMinutes);
  }

  mergeDraftWithMessage(intent, draft, incomingMessage);

  const previousMissing = state.missingFields || [];
  if (previousMissing.includes("title") && !draft.title) {
    draft.title = incomingMessage;
  }
  if (previousMissing.includes("name") && !draft.name) {
    draft.name = incomingMessage;
  }

  const missingFields = getMissingFields(intent, draft);

  if (missingFields.length > 0) {
    const prompt = fieldPrompt(intent, missingFields[0]);

    await prisma.whatsAppConversation.update({
      where: { id: conversation.id },
      data: {
        caregiverId:
          caregiverLinks.find((link) => link.profile.id === selectedProfileId)?.caregiverId || null,
        elderlyProfileId: selectedProfileId,
        intent,
        state: {
          draft,
          missingFields,
        } as unknown as Prisma.InputJsonValue,
        lastAssistantMessage: prompt,
      },
    });

    return prompt;
  }

  const selectedProfile = profileOptions.find((p) => p.id === selectedProfileId);
  const selectedCaregiver = caregiverLinks.find((link) => link.profile.id === selectedProfileId);

  if (!selectedProfile || !selectedCaregiver) {
    const message = "I couldn't identify which profile to update. Please try again and include the elderly name.";
    await prisma.whatsAppConversation.update({
      where: { id: conversation.id },
      data: {
        intent,
        state: {
          draft,
        } as unknown as Prisma.InputJsonValue,
        lastAssistantMessage: message,
      },
    });
    return message;
  }

  if (intent === "REMINDER") {
    await createCustomReminder(selectedProfile.id, draft);

    const message = `Done. I added the reminder "${draft.title}" for ${selectedProfile.name} at ${draft.scheduledTime}. It will now appear on the website.`;
    await resetConversation(
      conversation.id,
      fromPhone,
      message,
      selectedProfile.id,
      selectedCaregiver.caregiverId
    );
    return message;
  }

  if (intent === "MEDICATION") {
    await createMedicationWithReminder(selectedProfile.id, draft);

    const message = `Done. I added medication "${draft.name}" for ${selectedProfile.name} with reminders at ${draft.scheduledTime}. It is visible on the website now.`;
    await resetConversation(
      conversation.id,
      fromPhone,
      message,
      selectedProfile.id,
      selectedCaregiver.caregiverId
    );
    return message;
  }

  const { active: canActivate } = await createOrUpdateAssessment(selectedProfile.id, draft);

  const message = canActivate
    ? `Done. I set the daily assessment time for ${selectedProfile.name} to ${draft.scheduledTime}. It is active and visible on the website.`
    : `I set the assessment time for ${selectedProfile.name} to ${draft.scheduledTime}. It is visible on the website, but activation still needs at least 10 questions.`;

  await resetConversation(
    conversation.id,
    fromPhone,
    message,
    selectedProfile.id,
    selectedCaregiver.caregiverId
  );

  return message;
}
