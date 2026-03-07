import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const profile = await prisma.elderlyProfile.findFirst({
    where: { id, managerId: user.id },
  });

  if (!profile)
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

  const profile = await prisma.elderlyProfile.findFirst({
    where: { id, managerId: user.id },
  });

  if (!profile)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { name, dosage, instructions } = await req.json();

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

  return NextResponse.json(medication, { status: 201 });
}
