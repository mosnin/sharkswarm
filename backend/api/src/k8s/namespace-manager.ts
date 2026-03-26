import * as k8s from "@kubernetes/client-node";

// ── Constants ─────────────────────────────────────────────────────
const NAMESPACE = "sharkswarm-agents";

const LABELS = {
  ORG_ID: "sharkswarm.io/org-id",
  COMPONENT: "sharkswarm.io/component",
} as const;

// ── K8s client setup ──────────────────────────────────────────────
const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const coreApi = kc.makeApiClient(k8s.CoreV1Api);

// ── Public API ────────────────────────────────────────────────────

/**
 * Creates the shared `sharkswarm-agents` namespace if it does not
 * already exist. Safe to call repeatedly (idempotent).
 */
export async function ensureAgentNamespace(): Promise<void> {
  try {
    await coreApi.readNamespace({ name: NAMESPACE });
    // Already exists
  } catch {
    // Does not exist -- create it
    await coreApi.createNamespace({
      body: {
        apiVersion: "v1",
        kind: "Namespace",
        metadata: {
          name: NAMESPACE,
          labels: {
            [LABELS.COMPONENT]: "agents",
            "sharkswarm.io/managed-by": "sharkswarm-api",
          },
        },
      },
    });
  }
}

/**
 * Creates or updates a K8s Secret containing the organisation's API keys.
 * The secret is placed in the shared agent namespace and labelled with the
 * org-id so agent Deployments can reference it via `secretKeyRef`.
 */
export async function createOrgSecret(
  orgId: string,
  apiKeys: Record<string, string>,
): Promise<void> {
  const secretName = `org-${orgId}-secrets`;
  const labels: Record<string, string> = {
    [LABELS.ORG_ID]: orgId,
    [LABELS.COMPONENT]: "org-secret",
  };

  // Convert plain-text values to base64-encoded stringData (K8s handles
  // encoding when using `stringData`).
  const secretBody: k8s.V1Secret = {
    apiVersion: "v1",
    kind: "Secret",
    metadata: {
      name: secretName,
      namespace: NAMESPACE,
      labels,
    },
    type: "Opaque",
    stringData: apiKeys,
  };

  try {
    await coreApi.readNamespacedSecret({ name: secretName, namespace: NAMESPACE });
    // Exists -- replace it
    await coreApi.replaceNamespacedSecret({
      name: secretName,
      namespace: NAMESPACE,
      body: secretBody,
    });
  } catch {
    // Does not exist -- create it
    await coreApi.createNamespacedSecret({
      namespace: NAMESPACE,
      body: secretBody,
    });
  }
}

/**
 * Deletes all K8s resources (Deployments, Services, Pods, Secrets) that
 * belong to the given organisation, identified by the org-id label.
 */
export async function deleteOrgResources(orgId: string): Promise<void> {
  const labelSelector = `${LABELS.ORG_ID}=${orgId}`;

  const appsApi = kc.makeApiClient(k8s.AppsV1Api);

  // Delete Deployments
  try {
    await appsApi.deleteCollectionNamespacedDeployment({
      namespace: NAMESPACE,
      labelSelector,
    });
  } catch {
    // Nothing to delete or already gone
  }

  // Delete Services
  try {
    const { items } = await coreApi.listNamespacedService({
      namespace: NAMESPACE,
      labelSelector,
    });
    if (items) {
      for (const svc of items) {
        const name = svc.metadata?.name;
        if (name) {
          await coreApi.deleteNamespacedService({ name, namespace: NAMESPACE });
        }
      }
    }
  } catch {
    // Nothing to delete
  }

  // Delete Secrets
  try {
    const { items } = await coreApi.listNamespacedSecret({
      namespace: NAMESPACE,
      labelSelector,
    });
    if (items) {
      for (const secret of items) {
        const name = secret.metadata?.name;
        if (name) {
          await coreApi.deleteNamespacedSecret({ name, namespace: NAMESPACE });
        }
      }
    }
  } catch {
    // Nothing to delete
  }

  // Delete any remaining Pods (orphans from deleted deployments)
  try {
    await coreApi.deleteCollectionNamespacedPod({
      namespace: NAMESPACE,
      labelSelector,
    });
  } catch {
    // Nothing to delete
  }
}
