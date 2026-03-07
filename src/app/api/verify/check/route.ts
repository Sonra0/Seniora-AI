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

    const { phone, code, type, entityId } = await req.json();

    if (!phone || !code || !type || !entityId) {
      return NextResponse.json(
        { error: "Missing required fields: phone, code, type, entityId" },
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

    const verificationCheck = await twilioClient.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID!)
      .verificationChecks.create({ to: phone, code });

    if (verificationCheck.status !== "approved") {
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 }
      );
    }

    // Update the record to mark phone as verified
    if (type === "elderly") {
      await prisma.elderlyProfile.update({
        where: { id: entityId },
        data: { phoneVerified: true },
      });
    } else if (type === "emergency") {
      await prisma.elderlyProfile.update({
        where: { id: entityId },
        data: { emergencyPhoneVerified: true },
      });
    } else {
      await prisma.caregiver.update({
        where: { id: entityId },
        data: { phoneVerified: true },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Verify check error:", error);
    return NextResponse.json(
      { error: "Failed to verify code" },
      { status: 500 }
    );
  }
}
