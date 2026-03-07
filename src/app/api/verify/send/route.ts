import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { twilioClient } from "@/lib/twilio";
import { getProfileAccess } from "@/lib/access";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { phone, type, entityId } = await req.json();

    if (!phone || !type || !entityId) {
      return NextResponse.json(
        { error: "Missing required fields: phone, type, entityId" },
        { status: 400 }
      );
    }

    if (type !== "elderly" && type !== "caregiver" && type !== "emergency") {
      return NextResponse.json(
        { error: "Type must be 'elderly', 'caregiver', or 'emergency'" },
        { status: 400 }
      );
    }

    // Verify the authenticated user has access to the entity
    if (type === "elderly" || type === "emergency") {
      const role = await getProfileAccess(user, entityId);
      if (!role) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    } else {
      const caregiver = await prisma.caregiver.findFirst({
        where: { id: entityId },
        select: { elderlyProfileId: true },
      });
      if (!caregiver) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      const role = await getProfileAccess(user, caregiver.elderlyProfileId);
      if (!role) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    await twilioClient.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID!)
      .verifications.create({ to: phone, channel: "sms" });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Verify send error:", error);
    return NextResponse.json(
      { error: "Failed to send verification code" },
      { status: 500 }
    );
  }
}
