import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; medId: string }> }
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, medId } = await params;

  const profile = await prisma.elderlyProfile.findFirst({
    where: { id, managerId: user.id },
  });

  if (!profile)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { name, dosage, instructions } = await req.json();

  const medication = await prisma.medication.updateMany({
    where: { id: medId, elderlyProfileId: id },
    data: {
      ...(name !== undefined && { name }),
      ...(dosage !== undefined && { dosage: dosage || null }),
      ...(instructions !== undefined && { instructions: instructions || null }),
    },
  });

  if (medication.count === 0)
    return NextResponse.json(
      { error: "Medication not found" },
      { status: 404 }
    );

  const updated = await prisma.medication.findUnique({
    where: { id: medId },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; medId: string }> }
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, medId } = await params;

  const profile = await prisma.elderlyProfile.findFirst({
    where: { id, managerId: user.id },
  });

  if (!profile)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.medication.deleteMany({
    where: { id: medId, elderlyProfileId: id },
  });

  return NextResponse.json({ success: true });
}
