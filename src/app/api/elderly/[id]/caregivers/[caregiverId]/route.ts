import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProfileAccess } from "@/lib/access";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; caregiverId: string }> }
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, caregiverId } = await params;

  const role = await getProfileAccess(user, id);
  if (!role)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { phone } = await req.json();

  if (!phone || typeof phone !== "string") {
    return NextResponse.json(
      { error: "Phone is required" },
      { status: 400 }
    );
  }

  const caregiver = await prisma.caregiver.updateMany({
    where: { id: caregiverId, elderlyProfileId: id },
    data: { phone, phoneVerified: false },
  });

  if (caregiver.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; caregiverId: string }> }
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, caregiverId } = await params;

  const role = await getProfileAccess(user, id);
  if (!role)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.caregiver.deleteMany({
    where: { id: caregiverId, elderlyProfileId: id },
  });

  return NextResponse.json({ success: true });
}
