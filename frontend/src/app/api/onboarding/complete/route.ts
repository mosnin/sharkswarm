import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, status: "active" },
  });
  if (!membership) return NextResponse.json({ error: "No org" }, { status: 404 });

  await prisma.settings.upsert({
    where: { organizationId: membership.organizationId },
    update: { onboardingCompleted: true },
    create: {
      organizationId: membership.organizationId,
      onboardingCompleted: true,
    },
  });

  return NextResponse.json({ ok: true });
}
