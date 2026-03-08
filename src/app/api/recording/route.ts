import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = req.nextUrl.searchParams.get("url");
  if (!url || !url.includes("twilio.com")) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  // Verify the recording belongs to a session the user has access to
  const answer = await prisma.assessmentAnswer.findFirst({
    where: { recordingUrl: url },
    include: {
      session: {
        include: {
          elderlyProfile: {
            include: { caregivers: true },
          },
        },
      },
    },
  });

  if (!answer) {
    return NextResponse.json({ error: "Recording not found" }, { status: 404 });
  }

  const profile = answer.session.elderlyProfile;
  const hasAccess =
    profile.managerId === user.id ||
    profile.caregivers.some((c: { userId: string | null }) => c.userId === user.id);

  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const authHeader = `Basic ${Buffer.from(
      `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
    ).toString("base64")}`;

    const response = await fetch(url, {
      headers: { Authorization: authHeader },
      redirect: "follow",
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Recording not available" }, { status: 404 });
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch recording" }, { status: 500 });
  }
}
