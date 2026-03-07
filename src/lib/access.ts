import { prisma } from "./prisma";

interface User {
  id: string;
  email: string;
}

/**
 * Check if user has access to an elderly profile (as manager or caregiver).
 * Returns the role or null if no access.
 */
export async function getProfileAccess(
  user: User,
  elderlyProfileId: string
): Promise<"manager" | "caregiver" | null> {
  // Check if user is the manager
  const asManager = await prisma.elderlyProfile.findFirst({
    where: { id: elderlyProfileId, managerId: user.id },
  });
  if (asManager) return "manager";

  // Check if user is a linked caregiver
  const asCaregiver = await prisma.caregiver.findFirst({
    where: { elderlyProfileId, userId: user.id },
  });
  if (asCaregiver) return "caregiver";

  return null;
}
