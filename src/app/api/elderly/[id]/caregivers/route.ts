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

  const caregivers = await prisma.caregiver.findMany({
    where: { elderlyProfileId: id },
    include: { user: { select: { avatarUrl: true } } },
    orderBy: { createdAt: "desc" },
  });

  // Flatten user avatar into caregiver object
  const result = caregivers.map(({ user, ...cg }) => ({
    ...cg,
    avatarUrl: user?.avatarUrl || null,
  }));

  return NextResponse.json(result);
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

  const { name, email, phone } = await req.json();

  if (!name || !phone) {
    return NextResponse.json(
      { error: "Name and phone are required" },
      { status: 400 }
    );
  }

  // If email provided, check if a user already exists with that email
  let userId: string | null = null;
  if (email) {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) userId = existingUser.id;
  }

  const caregiver = await prisma.caregiver.create({
    data: {
      name,
      email: email || null,
      phone,
      userId,
      elderlyProfileId: id,
    },
  });

  return NextResponse.json(caregiver, { status: 201 });
}
