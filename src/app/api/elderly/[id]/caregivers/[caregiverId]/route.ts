import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; caregiverId: string }> }
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, caregiverId } = await params;

  const profile = await prisma.elderlyProfile.findFirst({
    where: { id, managerId: user.id },
  });

  if (!profile)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.caregiver.deleteMany({
    where: { id: caregiverId, elderlyProfileId: id },
  });

  return NextResponse.json({ success: true });
}
