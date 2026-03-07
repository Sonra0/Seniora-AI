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

  const medications = await prisma.medication.findMany({
    where: { elderlyProfileId: id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(medications);
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

  const { name, dosage, instructions, scheduledTime, recurrence } = await req.json();

  if (!name) {
    return NextResponse.json(
      { error: "Medication name is required" },
      { status: 400 }
    );
  }

  const medication = await prisma.medication.create({
    data: {
      name,
      dosage: dosage || null,
      instructions: instructions || null,
      elderlyProfileId: id,
    },
  });

  // Auto-create a linked reminder for this medication
  if (scheduledTime) {
    await prisma.reminder.create({
      data: {
        type: "MEDICATION",
        title: name,
        description: dosage ? `Dosage: ${dosage}` : null,
        medicationId: medication.id,
        scheduledTime,
        recurrence: recurrence || "DAILY",
        elderlyProfileId: id,
      },
    });
  }

  return NextResponse.json(medication, { status: 201 });
}
