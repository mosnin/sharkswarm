// ── GLORB Memory Manager (6-Layer Memory System) ────────────────

import { query } from "../db";
import type { MemoryLayer, MemoryEntry } from "./types";

// ── Layer Governance ────────────────────────────────────────────

const LAYER_TTL: Record<MemoryLayer, number | null> = {
  working: 3600,       // 1 hour
  session: 86400,      // 24 hours
  mission: null,       // persists until mission completes
  project: null,       // persists indefinitely
  reusable: null,      // human-curated, permanent
  archived: null,      // permanent archive
};

const LAYER_HIERARCHY: MemoryLayer[] = [
  "working", "session", "mission", "project", "reusable", "archived",
];

// ── Read ────────────────────────────────────────────────────────

export async function retrieveMemory(
  layer: MemoryLayer,
  scopeId: string,
  opts?: { key?: string; limit?: number }
): Promise<MemoryEntry[]> {
  const params: unknown[] = [layer, scopeId];
  let sql = `SELECT * FROM glorb_memory WHERE layer = $1 AND scope_id = $2`;

  if (opts?.key) {
    params.push(opts.key);
    sql += ` AND key = $${params.length}`;
  }

  // Exclude expired entries
  sql += ` AND (expires_at IS NULL OR expires_at > NOW())`;
  sql += ` ORDER BY created_at DESC`;

  if (opts?.limit) {
    params.push(opts.limit);
    sql += ` LIMIT $${params.length}`;
  }

  return query<MemoryEntry>(sql, params);
}

// Search across multiple layers (respects hierarchy)
export async function searchMemory(
  scopeId: string,
  searchKey: string,
  maxLayers?: MemoryLayer[]
): Promise<MemoryEntry[]> {
  const layers = maxLayers || LAYER_HIERARCHY;
  const placeholders = layers.map((_, i) => `$${i + 1}`).join(", ");
  const params: unknown[] = [...layers, scopeId, `%${searchKey}%`];

  const sql = `
    SELECT * FROM glorb_memory
    WHERE layer IN (${placeholders})
      AND scope_id = $${layers.length + 1}
      AND key LIKE $${layers.length + 2}
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY created_at DESC
    LIMIT 50
  `;

  return query<MemoryEntry>(sql, params);
}

// ── Write ───────────────────────────────────────────────────────

export async function persistMemory(
  layer: MemoryLayer,
  scopeId: string,
  key: string,
  content: unknown,
  opts?: { metadata?: Record<string, unknown>; createdBy?: string }
): Promise<MemoryEntry> {
  const ttl = LAYER_TTL[layer];
  const expiresAt = ttl ? new Date(Date.now() + ttl * 1000).toISOString() : null;

  const rows = await query<MemoryEntry>(
    `INSERT INTO glorb_memory (layer, scope_id, key, content, metadata, created_by, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [
      layer,
      scopeId,
      key,
      JSON.stringify(content),
      JSON.stringify(opts?.metadata || {}),
      opts?.createdBy || null,
      expiresAt,
    ]
  );

  // If conflict (key already exists), update instead
  if (rows.length === 0) {
    const updated = await query<MemoryEntry>(
      `UPDATE glorb_memory
       SET content = $1, metadata = $2, updated_at = NOW(), expires_at = $3
       WHERE layer = $4 AND scope_id = $5 AND key = $6
       RETURNING *`,
      [
        JSON.stringify(content),
        JSON.stringify(opts?.metadata || {}),
        expiresAt,
        layer,
        scopeId,
        key,
      ]
    );
    return updated[0];
  }

  return rows[0];
}

// ── Promote (move knowledge up the hierarchy) ───────────────────

export async function promoteMemory(
  entryId: number,
  targetLayer: MemoryLayer,
  newScopeId?: string
): Promise<MemoryEntry> {
  const existing = await query<MemoryEntry>(
    "SELECT * FROM glorb_memory WHERE id = $1",
    [entryId]
  );
  if (!existing.length) throw new Error(`Memory entry ${entryId} not found`);

  const entry = existing[0];
  const currentIdx = LAYER_HIERARCHY.indexOf(entry.layer);
  const targetIdx = LAYER_HIERARCHY.indexOf(targetLayer);
  if (targetIdx <= currentIdx) {
    throw new Error(`Cannot promote from ${entry.layer} to ${targetLayer} (must go up)`);
  }

  return persistMemory(
    targetLayer,
    newScopeId || entry.scope_id,
    entry.key,
    entry.content,
    {
      metadata: {
        ...entry.metadata as Record<string, unknown>,
        promoted_from: entry.layer,
        promoted_at: new Date().toISOString(),
      },
      createdBy: entry.created_by || undefined,
    }
  );
}

// ── Compress (reduce memory footprint) ──────────────────────────

export async function compressMemory(
  layer: MemoryLayer,
  scopeId: string,
  strategy: "deduplicate" | "expire" | "archive" = "expire"
): Promise<{ removed: number }> {
  let removed = 0;

  switch (strategy) {
    case "expire": {
      const result = await query<{ count: string }>(
        `WITH deleted AS (
           DELETE FROM glorb_memory
           WHERE layer = $1 AND scope_id = $2 AND expires_at < NOW()
           RETURNING id
         ) SELECT COUNT(*)::text as count FROM deleted`,
        [layer, scopeId]
      );
      removed = parseInt(result[0]?.count || "0", 10);
      break;
    }

    case "deduplicate": {
      const result = await query<{ count: string }>(
        `WITH dupes AS (
           SELECT id, ROW_NUMBER() OVER (PARTITION BY key ORDER BY updated_at DESC) as rn
           FROM glorb_memory
           WHERE layer = $1 AND scope_id = $2
         ),
         deleted AS (
           DELETE FROM glorb_memory WHERE id IN (SELECT id FROM dupes WHERE rn > 1)
           RETURNING id
         ) SELECT COUNT(*)::text as count FROM deleted`,
        [layer, scopeId]
      );
      removed = parseInt(result[0]?.count || "0", 10);
      break;
    }

    case "archive": {
      // Move old working/session entries to archived layer
      if (layer === "working" || layer === "session") {
        const cutoff = new Date(Date.now() - 86400000).toISOString(); // 24h ago
        const old = await query<MemoryEntry>(
          `SELECT * FROM glorb_memory WHERE layer = $1 AND scope_id = $2 AND created_at < $3`,
          [layer, scopeId, cutoff]
        );
        for (const entry of old) {
          await persistMemory("archived", scopeId, entry.key, entry.content, {
            metadata: { archived_from: layer },
            createdBy: entry.created_by || undefined,
          });
        }
        const result = await query<{ count: string }>(
          `WITH deleted AS (
             DELETE FROM glorb_memory
             WHERE layer = $1 AND scope_id = $2 AND created_at < $3
             RETURNING id
           ) SELECT COUNT(*)::text as count FROM deleted`,
          [layer, scopeId, cutoff]
        );
        removed = parseInt(result[0]?.count || "0", 10);
      }
      break;
    }
  }

  return { removed };
}

// ── Cleanup expired entries globally ────────────────────────────

export async function cleanupExpired(): Promise<number> {
  const result = await query<{ count: string }>(
    `WITH deleted AS (
       DELETE FROM glorb_memory WHERE expires_at < NOW() RETURNING id
     ) SELECT COUNT(*)::text as count FROM deleted`
  );
  return parseInt(result[0]?.count || "0", 10);
}
