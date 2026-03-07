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

  const profile = await prisma.elderlyProfile.findUnique({
    where: { id },
    include: { caregivers: true, medications: true, reminders: true },
  });

  if (!profile)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ...profile, role });
}

export async function PUT(
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

  const data = await req.json();

  const profile = await prisma.elderlyProfile.update({
    where: { id },
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

  // Only managers can delete profiles
  const profile = await prisma.elderlyProfile.findFirst({
    where: { id, managerId: user.id },
  });
  if (!profile)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.elderlyProfile.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
