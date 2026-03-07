import { getSession } from "@auth0/nextjs-auth0";
import { prisma } from "./prisma";

export async function getCurrentUser() {
  const session = await getSession();
  if (!session?.user) return null;

  const user = await prisma.user.upsert({
    where: { auth0Id: session.user.sub },
    update: { email: session.user.email, name: session.user.name },
    create: {
      auth0Id: session.user.sub,
      email: session.user.email,
      name: session.user.name,
    },
  });

  return user;
}
