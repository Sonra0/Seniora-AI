import { prisma } from "@/lib/prisma";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Types
export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

// Send a text message (with optional inline keyboard)
export async function sendMessage(
  chatId: string,
  text: string,
  replyMarkup?: InlineKeyboardMarkup
): Promise<void> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
  };
  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }
  const res = await fetch(`${API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Telegram sendMessage failed: ${res.status} ${err}`);
  }
}

// Answer a callback query (acknowledge inline keyboard press)
export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string
): Promise<void> {
  const body: Record<string, unknown> = {
    callback_query_id: callbackQueryId,
  };
  if (text) {
    body.text = text;
  }
  const res = await fetch(`${API}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(
      `Telegram answerCallbackQuery failed: ${res.status} ${err}`
    );
  }
}

// Edit an existing message text (for updating inline keyboard state)
export async function editMessageText(
  chatId: string,
  messageId: number,
  text: string,
  replyMarkup?: InlineKeyboardMarkup
): Promise<void> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "Markdown",
  };
  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }
  const res = await fetch(`${API}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Telegram editMessageText failed: ${res.status} ${err}`);
  }
}

// Download a file by file_id (for voice messages)
export async function downloadFile(fileId: string): Promise<Buffer> {
  // 1. Get file path from Telegram
  const getFileRes = await fetch(`${API}/getFile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: fileId }),
  });
  if (!getFileRes.ok) {
    const err = await getFileRes.text();
    throw new Error(`Telegram getFile failed: ${getFileRes.status} ${err}`);
  }
  const getFileData = await getFileRes.json();
  const filePath = getFileData.result?.file_path;
  if (!filePath) {
    throw new Error("Telegram getFile returned no file_path");
  }

  // 2. Download the file
  const downloadRes = await fetch(
    `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`
  );
  if (!downloadRes.ok) {
    throw new Error(
      `Telegram file download failed: ${downloadRes.status}`
    );
  }
  const arrayBuffer = await downloadRes.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Send notification to all caregivers linked via Telegram for a given elderly profile
export async function sendTelegramNotification(
  elderlyProfileId: string,
  message: string
): Promise<void> {
  const caregivers = await prisma.caregiver.findMany({
    where: {
      elderlyProfileId,
      telegramChatId: { not: null },
    },
  });

  await Promise.allSettled(
    caregivers.map(async (cg) => {
      try {
        await sendMessage(cg.telegramChatId!, message);
      } catch (err) {
        console.error(
          `Failed to send Telegram notification to caregiver ${cg.id}:`,
          err
        );
      }
    })
  );
}

// Helper: build profile selection keyboard
export function buildProfileKeyboard(
  profiles: { id: string; name: string }[]
): InlineKeyboardMarkup {
  return {
    inline_keyboard: profiles.map((p) => [
      { text: p.name, callback_data: `profile:${p.id}` },
    ]),
  };
}

// Helper: build confirmation keyboard (Yes/No)
export function buildConfirmKeyboard(
  action: string,
  id: string
): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "Yes", callback_data: `confirm_${action}:${id}` },
        { text: "No", callback_data: "cancel_action" },
      ],
    ],
  };
}

// Helper: build pagination keyboard
export function buildPaginationKeyboard(
  currentPage: number,
  totalPages: number,
  prefix: string
): InlineKeyboardMarkup {
  const buttons: InlineKeyboardButton[] = [];
  if (currentPage > 0) {
    buttons.push({
      text: "\u2B05 Previous",
      callback_data: `page:${prefix}:${currentPage - 1}`,
    });
  }
  if (currentPage < totalPages - 1) {
    buttons.push({
      text: "Next \u27A1",
      callback_data: `page:${prefix}:${currentPage + 1}`,
    });
  }
  return { inline_keyboard: [buttons] };
}

// Helper: build item selection keyboard
export function buildItemKeyboard(
  items: { id: string; label: string }[],
  actionPrefix: string
): InlineKeyboardMarkup {
  return {
    inline_keyboard: items.map((item) => [
      { text: item.label, callback_data: `${actionPrefix}:${item.id}` },
    ]),
  };
}
