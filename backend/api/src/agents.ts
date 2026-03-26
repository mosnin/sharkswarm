import { prisma } from "./prisma";
import {
  createAgentPod,
  deleteAgentPod,
  agentInternalUrl,
} from "./k8s/agent-manager";

// ── Types ────────────────────────────────────────────────────────

export interface AgentConfig {
  id: string;
  name: string;
  internalUrl: string;
  publicUrl: string;
  systemPrompt: string;
  model: string;
  tools: string[];
}

// ── Bootstrap ────────────────────────────────────────────────────

/**
 * Initialises the agent registry.
 *
 * With Prisma the schema is managed by migrations, so there is no DDL to run.
 * This function is kept as a no-op so that `index.ts` startup does not need to
 * change.
 */
export async function initAgentRegistry(): Promise<void> {
  // Schema is managed by Prisma migrations — nothing to do at runtime.
}

// ── Helpers ──────────────────────────────────────────────────────

function toAgentConfig(row: {
  id: string;
  name: string;
  systemPrompt: string;
  model: string;
  tools: string[];
}): AgentConfig {
  return {
    id: row.id,
    name: row.name,
    internalUrl: agentInternalUrl(row.id),
    publicUrl: "",
    systemPrompt: row.systemPrompt ?? "",
    model: row.model,
    tools: row.tools ?? [],
  };
}

// ── CRUD ─────────────────────────────────────────────────────────

export async function getAllAgents(organizationId: string): Promise<AgentConfig[]> {
  const rows = await prisma.agent.findMany({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toAgentConfig);
}

export async function getAgent(
  id: string,
  organizationId: string,
): Promise<AgentConfig | undefined> {
  const row = await prisma.agent.findFirst({
    where: { id, organizationId },
  });
  return row ? toAgentConfig(row) : undefined;
}

export async function createAgent(
  organizationId: string,
  fields: {
    name: string;
    systemPrompt: string;
    model: string;
    tools: string[];
  },
): Promise<AgentConfig> {
  // Create the DB record first (Prisma generates the UUID)
  const row = await prisma.agent.create({
    data: {
      organizationId,
      name: fields.name,
      systemPrompt: fields.systemPrompt,
      model: fields.model,
      tools: fields.tools,
      status: "starting",
    },
  });

  // Spin up a K8s Deployment + Service for the agent
  try {
    await createAgentPod(organizationId, row.id, {
      name: fields.name,
      model: fields.model,
      systemPrompt: fields.systemPrompt,
      tools: fields.tools,
      resourceLimits: { cpuMillis: 500, memoryMi: 512 },
    });

    await prisma.agent.update({
      where: { id: row.id },
      data: { status: "running" },
    });
  } catch (err) {
    // Pod creation failed — mark the agent as failed so the UI can show it
    await prisma.agent.update({
      where: { id: row.id },
      data: { status: "failed" },
    });
    throw new Error(`Failed to create K8s pod for agent ${row.id}: ${err}`);
  }

  return toAgentConfig(row);
}

export async function updateAgent(
  id: string,
  organizationId: string,
  updates: Partial<AgentConfig>,
): Promise<AgentConfig | undefined> {
  // Ensure the agent belongs to this org before updating
  const existing = await prisma.agent.findFirst({
    where: { id, organizationId },
  });
  if (!existing) return undefined;

  const row = await prisma.agent.update({
    where: { id },
    data: {
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.systemPrompt !== undefined && { systemPrompt: updates.systemPrompt }),
      ...(updates.model !== undefined && { model: updates.model }),
      ...(updates.tools !== undefined && { tools: updates.tools }),
    },
  });

  return toAgentConfig(row);
}

export async function deleteAgent(
  id: string,
  organizationId: string,
): Promise<boolean> {
  // Ensure the agent belongs to this org
  const existing = await prisma.agent.findFirst({
    where: { id, organizationId },
  });
  if (!existing) return false;

  // Tear down K8s resources first (best-effort)
  try {
    await deleteAgentPod(organizationId, id);
  } catch {
    // Pod may already be gone — continue with DB cleanup
  }

  await prisma.agent.delete({ where: { id } });
  return true;
}
