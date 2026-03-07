import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profiles = await prisma.elderlyProfile.findMany({
    where: { managerId: user.id },
    include: { caregivers: true, _count: { select: { reminders: true } } },
  });

  return NextResponse.json(profiles);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, phone, language } = await req.json();

  if (!name || !phone) {
    return NextResponse.json(
      { error: "Name and phone are required" },
      { status: 400 }
    );
  }

  const profile = await prisma.elderlyProfile.create({
    data: { name, phone, language: language || "en", managerId: user.id },
  });

  return NextResponse.json(profile, { status: 201 });
}
