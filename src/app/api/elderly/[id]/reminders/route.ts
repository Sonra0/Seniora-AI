import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProfileAccess } from "@/lib/access";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const role = await getProfileAccess(user, id);
  if (!role)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const reminders = await prisma.reminder.findMany({
    where: { elderlyProfileId: id },
    include: { medication: true },
    orderBy: [{ active: "desc" }, { scheduledTime: "asc" }],
  });

  return NextResponse.json(reminders);
}

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

  const {
    type,
    title,
    description,
    medicationId,
    scheduledTime,
    scheduledDate,
    recurrence,
    daysOfWeek,
    leadTimeMinutes,
    active,
  } = await req.json();

  if (!type || !title || !scheduledTime) {
    return NextResponse.json(
      { error: "Type, title, and scheduledTime are required" },
      { status: 400 }
    );
  }

  if (!["MEDICATION", "CUSTOM"].includes(type)) {
    return NextResponse.json(
      { error: "Type must be MEDICATION or CUSTOM" },
      { status: 400 }
    );
  }

  const reminder = await prisma.reminder.create({
    data: {
      type,
      title,
      description: description || null,
      medicationId: medicationId || null,
      scheduledTime,
      scheduledDate: scheduledDate || null,
      recurrence: recurrence || "DAILY",
      daysOfWeek: daysOfWeek || [],
      leadTimeMinutes: leadTimeMinutes ?? 0,
      active: active ?? true,
      elderlyProfileId: id,
    },
    include: { medication: true },
  });

  return NextResponse.json(reminder, { status: 201 });
}
