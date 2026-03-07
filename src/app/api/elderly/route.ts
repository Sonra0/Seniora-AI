import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get profiles the user manages
  const managedProfiles = await prisma.elderlyProfile.findMany({
    where: { managerId: user.id },
    include: { caregivers: true, _count: { select: { reminders: true } } },
  });

  // Get profiles the user is a caregiver for
  const caregiverLinks = await prisma.caregiver.findMany({
    where: { userId: user.id },
    select: { elderlyProfileId: true },
  });
  const caregiverProfileIds = caregiverLinks
    .map((c) => c.elderlyProfileId)
    .filter((id) => !managedProfiles.some((p) => p.id === id));

  const caregiverProfiles = caregiverProfileIds.length > 0
    ? await prisma.elderlyProfile.findMany({
        where: { id: { in: caregiverProfileIds } },
        include: { caregivers: true, _count: { select: { reminders: true } } },
      })
    : [];

  return NextResponse.json({
    managed: managedProfiles,
    caregiving: caregiverProfiles,
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, phone, language, timezone, emergencyContact, emergencyPhone } = await req.json();

  if (!name || !phone) {
    return NextResponse.json(
      { error: "Name and phone are required" },
      { status: 400 }
    );
  }

  if (!emergencyContact || !emergencyPhone) {
    return NextResponse.json(
      { error: "Emergency contact name and phone are required" },
      { status: 400 }
    );
  }

  try {
    const profile = await prisma.elderlyProfile.create({
      data: {
        name,
        phone,
        language: language || "en",
        timezone: timezone || "UTC",
        emergencyContact,
        emergencyPhone,
        managerId: user.id,
        caregivers: {
          create: {
            name: user.name || user.email,
            email: user.email,
            phone: "",
            userId: user.id,
          },
        },
      },
      include: { caregivers: true },
    });

    return NextResponse.json(profile, { status: 201 });
  } catch (err) {
    console.error("Failed to create elderly profile:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create profile" },
      { status: 500 }
    );
  }
}
