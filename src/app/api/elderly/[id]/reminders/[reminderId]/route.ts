import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; reminderId: string }> }
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, reminderId } = await params;

  const profile = await prisma.elderlyProfile.findFirst({
    where: { id, managerId: user.id },
  });

  if (!profile)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const {
    type,
    title,
    description,
    medicationId,
    scheduledTime,
    recurrence,
    daysOfWeek,
    leadTimeMinutes,
    active,
  } = await req.json();

  const result = await prisma.reminder.updateMany({
    where: { id: reminderId, elderlyProfileId: id },
    data: {
      ...(type !== undefined && { type }),
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description: description || null }),
      ...(medicationId !== undefined && {
        medicationId: medicationId || null,
      }),
      ...(scheduledTime !== undefined && { scheduledTime }),
      ...(recurrence !== undefined && { recurrence }),
      ...(daysOfWeek !== undefined && { daysOfWeek }),
      ...(leadTimeMinutes !== undefined && { leadTimeMinutes }),
      ...(active !== undefined && { active }),
    },
  });

  if (result.count === 0)
    return NextResponse.json(
      { error: "Reminder not found" },
      { status: 404 }
    );

  const updated = await prisma.reminder.findUnique({
    where: { id: reminderId },
    include: { medication: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; reminderId: string }> }
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, reminderId } = await params;

  const profile = await prisma.elderlyProfile.findFirst({
    where: { id, managerId: user.id },
  });

  if (!profile)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.reminder.deleteMany({
    where: { id: reminderId, elderlyProfileId: id },
  });

  return NextResponse.json({ success: true });
}
