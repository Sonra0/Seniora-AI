// Telegram Bot Webhook
// Register with: POST https://api.telegram.org/bot{TOKEN}/setWebhook
// Body: { "url": "https://YOUR_DOMAIN/api/webhooks/telegram", "secret_token": "YOUR_WEBHOOK_SECRET", "allowed_updates": ["message", "callback_query"] }

import { NextRequest, NextResponse } from "next/server";
import { handleTelegramUpdate } from "@/lib/telegram-assistant";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const update = await req.json();

  try {
    await handleTelegramUpdate(update);
  } catch (error) {
    console.error("Telegram webhook error:", error);
  }

  return NextResponse.json({ ok: true });
}
