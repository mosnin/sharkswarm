import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

export async function requireOrganization() {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });
  if (!user) throw new Error("User not found");

  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, status: "active" },
    include: { organization: true },
  });
  if (!membership) throw new Error("No active membership");

  return {
    userId: user.id,
    clerkId,
    organizationId: membership.organizationId,
    organization: membership.organization,
    role: membership.role,
  };
}

export async function requireUser() {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) throw new Error("User not found");

  return user;
}
