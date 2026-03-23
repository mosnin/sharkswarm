import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

export async function publishToAgent(
  fromAgent: string,
  toAgent: string,
  message: string
): Promise<void> {
  const channel = `agent:${toAgent}:inbox`;
  const payload = JSON.stringify({
    from_agent: fromAgent,
    to_agent: toAgent,
    message,
  });
  await redis.publish(channel, payload);
}

export default redis;
