import * as k8s from "@kubernetes/client-node";

// ── Types ─────────────────────────────────────────────────────────
export interface AgentConfig {
  name: string;
  model: string;
  systemPrompt: string;
  tools: string[];
  resourceLimits: { cpuMillis: number; memoryMi: number };
}

export interface AgentPodStatus {
  agentId: string;
  orgId: string;
  phase: "Running" | "Pending" | "Failed" | "Succeeded" | "Unknown";
  ready: boolean;
  restarts: number;
  createdAt: string | undefined;
}

// ── Constants ─────────────────────────────────────────────────────
const NAMESPACE = "sharkswarm-agents";
const AGENT_IMAGE = process.env.AGENT_IMAGE || "ghcr.io/openclaw/openclaw:slim";
const AGENT_PORT = 18789;

const LABELS = {
  ORG_ID: "sharkswarm.io/org-id",
  AGENT_ID: "sharkswarm.io/agent-id",
  COMPONENT: "sharkswarm.io/component",
} as const;

// ── K8s client setup ──────────────────────────────────────────────
const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const appsApi = kc.makeApiClient(k8s.AppsV1Api);
const coreApi = kc.makeApiClient(k8s.CoreV1Api);

// ── Helpers ───────────────────────────────────────────────────────

/** Deterministic resource name for an agent deployment/service. */
function resourceName(agentId: string): string {
  return `agent-${agentId}`;
}

/** Standard labels applied to every agent resource. */
function agentLabels(orgId: string, agentId: string): Record<string, string> {
  return {
    [LABELS.ORG_ID]: orgId,
    [LABELS.AGENT_ID]: agentId,
    [LABELS.COMPONENT]: "agent",
  };
}

/** Label selector string for a specific agent. */
function agentSelector(orgId: string, agentId: string): string {
  return `${LABELS.ORG_ID}=${orgId},${LABELS.AGENT_ID}=${agentId},${LABELS.COMPONENT}=agent`;
}

/** Label selector string for all agents belonging to an org. */
function orgSelector(orgId: string): string {
  return `${LABELS.ORG_ID}=${orgId},${LABELS.COMPONENT}=agent`;
}

/**
 * Returns the cluster-internal URL for an agent.
 * Consumers can reach the agent at this address from within the cluster.
 */
export function agentInternalUrl(agentId: string): string {
  return `http://agent-${agentId}.${NAMESPACE}.svc.cluster.local:${AGENT_PORT}`;
}

// ── Deployment spec builder ───────────────────────────────────────

function buildDeployment(
  orgId: string,
  agentId: string,
  config: AgentConfig,
): k8s.V1Deployment {
  const name = resourceName(agentId);
  const labels = agentLabels(orgId, agentId);
  const secretName = `org-${orgId}-secrets`;

  return {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: {
      name,
      namespace: NAMESPACE,
      labels,
    },
    spec: {
      replicas: 1,
      selector: { matchLabels: labels },
      strategy: { type: "Recreate" },
      template: {
        metadata: { labels },
        spec: {
          automountServiceAccountToken: false,
          securityContext: {
            fsGroup: 1000,
            seccompProfile: { type: "RuntimeDefault" },
          },
          containers: [
            {
              name: "gateway",
              image: AGENT_IMAGE,
              imagePullPolicy: "IfNotPresent",
              command: ["node", "/app/dist/index.js", "gateway", "run"],
              ports: [
                {
                  name: "gateway",
                  containerPort: AGENT_PORT,
                  protocol: "TCP",
                },
              ],
              env: [
                { name: "HOME", value: "/home/node" },
                { name: "OPENCLAW_CONFIG_DIR", value: "/home/node/.openclaw" },
                { name: "NODE_ENV", value: "production" },
                { name: "OPENCLAW_GATEWAY_BIND", value: "lan" },
                {
                  name: "OPENCLAW_SYSTEM_PROMPT",
                  value: config.systemPrompt,
                },
                {
                  name: "OPENCLAW_MODEL",
                  value: config.model,
                },
                {
                  name: "OPENAI_API_KEY",
                  valueFrom: {
                    secretKeyRef: {
                      name: secretName,
                      key: "OPENAI_API_KEY",
                      optional: true,
                    },
                  },
                },
                {
                  name: "ANTHROPIC_API_KEY",
                  valueFrom: {
                    secretKeyRef: {
                      name: secretName,
                      key: "ANTHROPIC_API_KEY",
                      optional: true,
                    },
                  },
                },
                {
                  name: "OPENROUTER_API_KEY",
                  valueFrom: {
                    secretKeyRef: {
                      name: secretName,
                      key: "OPENROUTER_API_KEY",
                      optional: true,
                    },
                  },
                },
              ],
              resources: {
                requests: {
                  memory: `${Math.floor(config.resourceLimits.memoryMi / 2)}Mi`,
                  cpu: `${Math.floor(config.resourceLimits.cpuMillis / 2)}m`,
                },
                limits: {
                  memory: `${config.resourceLimits.memoryMi}Mi`,
                  cpu: `${config.resourceLimits.cpuMillis}m`,
                },
              },
              livenessProbe: {
                exec: {
                  command: [
                    "node",
                    "-e",
                    `require('http').get('http://127.0.0.1:${AGENT_PORT}/healthz', r => process.exit(r.statusCode < 400 ? 0 : 1)).on('error', () => process.exit(1))`,
                  ],
                },
                initialDelaySeconds: 60,
                periodSeconds: 30,
                timeoutSeconds: 10,
              },
              readinessProbe: {
                exec: {
                  command: [
                    "node",
                    "-e",
                    `require('http').get('http://127.0.0.1:${AGENT_PORT}/readyz', r => process.exit(r.statusCode < 400 ? 0 : 1)).on('error', () => process.exit(1))`,
                  ],
                },
                initialDelaySeconds: 15,
                periodSeconds: 10,
                timeoutSeconds: 5,
              },
              volumeMounts: [
                {
                  name: "openclaw-home",
                  mountPath: "/home/node/.openclaw",
                },
                { name: "tmp-volume", mountPath: "/tmp" },
              ],
              securityContext: {
                runAsNonRoot: true,
                runAsUser: 1000,
                runAsGroup: 1000,
                allowPrivilegeEscalation: false,
                readOnlyRootFilesystem: true,
                capabilities: { drop: ["ALL"] },
              },
            },
          ],
          volumes: [
            { name: "openclaw-home", emptyDir: {} },
            { name: "tmp-volume", emptyDir: {} },
          ],
        },
      },
    },
  };
}

// ── Service spec builder ──────────────────────────────────────────

function buildService(
  orgId: string,
  agentId: string,
): k8s.V1Service {
  const name = resourceName(agentId);
  const labels = agentLabels(orgId, agentId);

  return {
    apiVersion: "v1",
    kind: "Service",
    metadata: {
      name,
      namespace: NAMESPACE,
      labels,
    },
    spec: {
      type: "ClusterIP",
      selector: labels,
      ports: [
        {
          name: "gateway",
          port: AGENT_PORT,
          targetPort: AGENT_PORT as unknown as object,
          protocol: "TCP",
        },
      ],
    },
  };
}

// ── Public API ────────────────────────────────────────────────────

/**
 * Creates a K8s Deployment + Service for an agent.
 * If either already exists it will be replaced.
 */
export async function createAgentPod(
  orgId: string,
  agentId: string,
  config: AgentConfig,
): Promise<{ internalUrl: string }> {
  const deploymentSpec = buildDeployment(orgId, agentId, config);
  const serviceSpec = buildService(orgId, agentId);
  const name = resourceName(agentId);

  // Upsert Deployment
  try {
    await appsApi.readNamespacedDeployment({ name, namespace: NAMESPACE });
    // Already exists -- replace it
    await appsApi.replaceNamespacedDeployment({
      name,
      namespace: NAMESPACE,
      body: deploymentSpec,
    });
  } catch {
    // Does not exist -- create it
    await appsApi.createNamespacedDeployment({
      namespace: NAMESPACE,
      body: deploymentSpec,
    });
  }

  // Upsert Service
  try {
    await coreApi.readNamespacedService({ name, namespace: NAMESPACE });
    await coreApi.replaceNamespacedService({
      name,
      namespace: NAMESPACE,
      body: serviceSpec,
    });
  } catch {
    await coreApi.createNamespacedService({
      namespace: NAMESPACE,
      body: serviceSpec,
    });
  }

  return { internalUrl: agentInternalUrl(agentId) };
}

/**
 * Deletes the Deployment + Service for an agent.
 * Silently succeeds if the resources do not exist.
 */
export async function deleteAgentPod(
  orgId: string,
  agentId: string,
): Promise<void> {
  const name = resourceName(agentId);

  try {
    await appsApi.deleteNamespacedDeployment({ name, namespace: NAMESPACE });
  } catch {
    // Already gone or never existed
  }

  try {
    await coreApi.deleteNamespacedService({ name, namespace: NAMESPACE });
  } catch {
    // Already gone or never existed
  }
}

/**
 * Returns the status of an agent's pod (the single replica managed by
 * the Deployment). Looks up pods via the agent label selector.
 */
export async function getAgentPodStatus(
  orgId: string,
  agentId: string,
): Promise<AgentPodStatus> {
  const labelSelector = agentSelector(orgId, agentId);

  const { items } = await coreApi.listNamespacedPod({
    namespace: NAMESPACE,
    labelSelector,
  });

  if (!items || items.length === 0) {
    return {
      agentId,
      orgId,
      phase: "Unknown",
      ready: false,
      restarts: 0,
      createdAt: undefined,
    };
  }

  // Take the newest pod (there should only be one for a Recreate strategy)
  const pod = items.sort((a, b) => {
    const tA = a.metadata?.creationTimestamp?.getTime() ?? 0;
    const tB = b.metadata?.creationTimestamp?.getTime() ?? 0;
    return tB - tA;
  })[0];

  const containerStatus = pod.status?.containerStatuses?.[0];

  return {
    agentId,
    orgId,
    phase: (pod.status?.phase as AgentPodStatus["phase"]) ?? "Unknown",
    ready: containerStatus?.ready ?? false,
    restarts: containerStatus?.restartCount ?? 0,
    createdAt: pod.metadata?.creationTimestamp?.toISOString(),
  };
}

/**
 * Restarts an agent by deleting its pod. The Deployment controller
 * will automatically recreate a replacement pod.
 */
export async function restartAgentPod(
  orgId: string,
  agentId: string,
): Promise<void> {
  const labelSelector = agentSelector(orgId, agentId);

  const { items } = await coreApi.listNamespacedPod({
    namespace: NAMESPACE,
    labelSelector,
  });

  if (items) {
    for (const pod of items) {
      const podName = pod.metadata?.name;
      if (podName) {
        await coreApi.deleteNamespacedPod({
          name: podName,
          namespace: NAMESPACE,
        });
      }
    }
  }
}

/**
 * Lists all agent pods for an organisation, identified by the org-id label.
 */
export async function listOrgAgentPods(
  orgId: string,
): Promise<AgentPodStatus[]> {
  const labelSelector = orgSelector(orgId);

  const { items } = await coreApi.listNamespacedPod({
    namespace: NAMESPACE,
    labelSelector,
  });

  if (!items || items.length === 0) return [];

  return items.map((pod) => {
    const containerStatus = pod.status?.containerStatuses?.[0];
    return {
      agentId: pod.metadata?.labels?.[LABELS.AGENT_ID] ?? "unknown",
      orgId,
      phase: (pod.status?.phase as AgentPodStatus["phase"]) ?? "Unknown",
      ready: containerStatus?.ready ?? false,
      restarts: containerStatus?.restartCount ?? 0,
      createdAt: pod.metadata?.creationTimestamp?.toISOString(),
    };
  });
}
