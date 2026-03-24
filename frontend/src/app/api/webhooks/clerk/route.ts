import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    return new Response("Missing webhook secret", { status: 500 });
  }

  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (evt.type === "user.created") {
    const { id, email_addresses, first_name, last_name, image_url } = evt.data;
    const email = email_addresses[0]?.email_address;
    if (!email) return new Response("No email", { status: 400 });

    const name = [first_name, last_name].filter(Boolean).join(" ") || "User";

    // Create user
    const user = await prisma.user.create({
      data: { clerkId: id, email, name, avatarUrl: image_url },
    });

    // Create default personal organization
    const slug = email.split("@")[0].replace(/[^a-z0-9-]/gi, "-").toLowerCase().slice(0, 60);
    const org = await prisma.organization.create({
      data: {
        name: `${name}'s Workspace`,
        slug: `${slug}-${user.id.slice(0, 8)}`,
        createdBy: user.id,
      },
    });

    // Create owner membership
    await prisma.membership.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        role: "owner",
        status: "active",
        joinedAt: new Date(),
      },
    });

    // Create default settings
    await prisma.settings.create({
      data: {
        organizationId: org.id,
        onboardingCompleted: false,
        onboardingStep: "role",
      },
    });
  }

  if (evt.type === "user.updated") {
    const { id, email_addresses, first_name, last_name, image_url } = evt.data;
    const email = email_addresses[0]?.email_address;
    await prisma.user.updateMany({
      where: { clerkId: id },
      data: {
        ...(email && { email }),
        name: [first_name, last_name].filter(Boolean).join(" ") || undefined,
        avatarUrl: image_url || undefined,
      },
    });
  }

  if (evt.type === "user.deleted") {
    const { id } = evt.data;
    if (id) {
      await prisma.user.deleteMany({ where: { clerkId: id } });
    }
  }

  return new Response("OK", { status: 200 });
}
