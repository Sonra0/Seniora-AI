import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProfileAccess } from "@/lib/access";
import crypto from "crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const role = await getProfileAccess(user, id);
  if (!role)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { caregiverId } = await req.json();
  if (!caregiverId)
    return NextResponse.json(
      { error: "caregiverId is required" },
      { status: 400 }
    );

  const caregiver = await prisma.caregiver.findFirst({
    where: { id: caregiverId, elderlyProfileId: id },
  });
  if (!caregiver)
    return NextResponse.json(
      { error: "Caregiver not found" },
      { status: 404 }
    );

  const linkCode = crypto.randomBytes(3).toString("hex").toUpperCase();
  const linkCodeExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.caregiver.update({
    where: { id: caregiverId },
    data: { linkCode, linkCodeExpiresAt },
  });

  return NextResponse.json({
    linkCode,
    expiresAt: linkCodeExpiresAt.toISOString(),
    botUsername: process.env.TELEGRAM_BOT_USERNAME || "SenioraBot",
  });
}
