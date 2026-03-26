import WebSocket from "ws";
import { getAgent, getAllAgents } from "./agents";

type JsonRpcResponse = {
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
};

let rpcIdCounter = 1;

/**
 * Send a JSON-RPC method call to an OpenClaw agent's gateway WebSocket.
 * Returns the result or throws on error/timeout.
 */
export async function callAgentGateway(
  agentId: string,
  method: string,
  params?: Record<string, unknown>,
  timeoutMs = 8000,
  organizationId?: string
): Promise<unknown> {
  // When organizationId is not provided, fall back to a dev default so
  // existing call-sites that don't yet have org context keep working.
  const orgId = organizationId ?? "00000000-0000-0000-0000-000000000000";
  const agent = await getAgent(agentId, orgId);
  if (!agent) throw new Error(`Agent ${agentId} not found`);

  // Agent's internalUrl is like http://agent-<id>.sharkswarm-agents.svc.cluster.local:18789
  const wsUrl = agent.internalUrl.replace(/^http/, "ws");

  return new Promise((resolve, reject) => {
    const id = rpcIdCounter++;
    const ws = new WebSocket(wsUrl);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error(`Gateway call ${method} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    ws.on("open", () => {
      ws.send(JSON.stringify({ jsonrpc: "2.0", id, method, params: params || {} }));
    });

    ws.on("message", (data: Buffer) => {
      try {
        const msg: JsonRpcResponse = JSON.parse(data.toString());
        if (msg.id === id) {
          clearTimeout(timer);
          ws.close();
          if (msg.error) {
            reject(new Error(msg.error.message));
          } else {
            resolve(msg.result);
          }
        }
      } catch {
        // ignore non-JSON messages
      }
    });

    ws.on("error", (err) => {
      clearTimeout(timer);
      ws.close();
      reject(err);
    });
  });
}

/**
 * Call a gateway method on all agents and return a map of agentId -> result.
 */
export async function callAllAgentsGateway(
  method: string,
  params?: Record<string, unknown>,
  organizationId?: string
): Promise<Record<string, unknown>> {
  const orgId = organizationId ?? "00000000-0000-0000-0000-000000000000";
  const agents = await getAllAgents(orgId);
  const results: Record<string, unknown> = {};

  await Promise.allSettled(
    agents.map(async (agent) => {
      try {
        results[agent.id] = await callAgentGateway(agent.id, method, params, 8000, orgId);
      } catch (err) {
        results[agent.id] = { error: err instanceof Error ? err.message : "Failed" };
      }
    })
  );

  return results;
}
