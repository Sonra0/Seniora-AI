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
    include: { caregivers: true, medications: true, reminders: true },
  });

  if (!profile)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(profile);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const data = await req.json();

  const profile = await prisma.elderlyProfile.updateMany({
    where: { id, managerId: user.id },
    data,
  });

  return NextResponse.json(profile);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  await prisma.elderlyProfile.deleteMany({
    where: { id, managerId: user.id },
  });

  return NextResponse.json({ success: true });
}
