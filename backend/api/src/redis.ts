import Redis from "ioredis";

export const redis = new Redis(process.env.REDIS_URL || "redis://redis:6379");

export async function publishToAgent(
  fromAgent: string,
  toAgent: string,
  content: string,
  organizationId?: string
) {
  const payload = JSON.stringify({
    from_agent: fromAgent,
    to_agent: toAgent,
    message: content,
    ...(organizationId ? { organizationId } : {}),
  });
  await redis.publish(`agent:${toAgent}:inbox`, payload);
}
