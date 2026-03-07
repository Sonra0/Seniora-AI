import { headers } from "next/headers";
import { adminAuth } from "./firebase-admin";
import { prisma } from "./prisma";

export async function getCurrentUser() {
  const headersList = await headers();
  const authorization = headersList.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;

  const token = authorization.split("Bearer ")[1];

  try {
    const decoded = await adminAuth.verifyIdToken(token);

    const user = await prisma.user.upsert({
      where: { firebaseUid: decoded.uid },
      update: { email: decoded.email!, name: decoded.name || null },
      create: {
        firebaseUid: decoded.uid,
        email: decoded.email!,
        name: decoded.name || null,
      },
    });

    // Auto-link any caregiver records that match this email
    await prisma.caregiver.updateMany({
      where: { email: decoded.email!, userId: null },
      data: { userId: user.id },
    });

    return user;
  } catch {
    return null;
  }
}
