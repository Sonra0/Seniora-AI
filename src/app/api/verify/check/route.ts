import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { twilioClient } from "@/lib/twilio";

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

    if (type !== "elderly" && type !== "caregiver") {
      return NextResponse.json(
        { error: "Type must be 'elderly' or 'caregiver'" },
        { status: 400 }
      );
    }

    // Verify the authenticated user owns the entity
    if (type === "elderly") {
      const profile = await prisma.elderlyProfile.findFirst({
        where: { id: entityId, managerId: user.id },
      });
      if (!profile) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    } else {
      const caregiver = await prisma.caregiver.findFirst({
        where: { id: entityId, elderlyProfile: { managerId: user.id } },
      });
      if (!caregiver) {
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
