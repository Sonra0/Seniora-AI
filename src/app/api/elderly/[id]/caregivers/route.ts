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

  const caregivers = await prisma.caregiver.findMany({
    where: { elderlyProfileId: id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(caregivers);
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

  const { name, phone } = await req.json();

  if (!name || !phone) {
    return NextResponse.json(
      { error: "Name and phone are required" },
      { status: 400 }
    );
  }

  const caregiver = await prisma.caregiver.create({
    data: {
      name,
      phone,
      elderlyProfileId: id,
    },
  });

  return NextResponse.json(caregiver, { status: 201 });
}
