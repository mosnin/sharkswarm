import type { Request, Response, NextFunction } from "express";
import { query } from "../db";

// ── Types ───────────────────────────────────────────────────────

export interface PlanLimit {
  maxAgents: number;
  maxMissions: number;
  apiRatePerMin: number;
}

// ── Plan limits by tier ─────────────────────────────────────────

export const PLAN_LIMITS: Record<string, PlanLimit> = {
  free:       { maxAgents: 1,   maxMissions: 3,   apiRatePerMin: 20   },
  starter:    { maxAgents: 3,   maxMissions: 10,  apiRatePerMin: 100  },
  pro:        { maxAgents: 10,  maxMissions: 50,  apiRatePerMin: 500  },
  enterprise: { maxAgents: 100, maxMissions: 999, apiRatePerMin: 2000 },
};

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Return the plan limits for a given plan name.
 * Falls back to `free` limits for unknown plans.
 */
export function getPlanLimits(plan: string): PlanLimit {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}

/**
 * Resolve the organization ID from the request.
 *
 * Priority:
 *  1. `req.params.organizationId`
 *  2. `x-organization-id` header
 *  3. `req.auth.org_id` (Clerk session claim)
 *
 * Returns `null` when no org can be determined.
 */
function resolveOrgId(req: Request): string | null {
  return (
    (req.params.organizationId as string) ||
    (req.headers["x-organization-id"] as string) ||
    (req.auth?.org_id as string | undefined) ||
    null
  );
}

/**
 * Fetch the plan for an organization using a raw SQL query.
 * (Prisma migration is still in progress, so we avoid generated client types.)
 */
async function getOrgPlan(orgId: string): Promise<string> {
  const rows = await query<{ plan: string }>(
    `SELECT plan FROM "Organization" WHERE id = $1 LIMIT 1`,
    [orgId],
  );
  if (!rows.length) return "free";
  return rows[0].plan;
}

// ── Middleware: enforce agent limit ─────────────────────────────

/**
 * Blocks agent creation when the organization has reached or exceeded the
 * agent limit for its current plan.
 *
 * Attach to `POST /api/agents` (or wherever agents are created).
 */
export function enforceAgentLimit(req: Request, res: Response, next: NextFunction): void {
  const orgId = resolveOrgId(req);

  if (!orgId) {
    // No org context — skip enforcement (e.g. local dev without multi-tenancy)
    return next();
  }

  (async () => {
    const plan = await getOrgPlan(orgId);
    const limits = getPlanLimits(plan);

    const countRows = await query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM "Agent" WHERE "organizationId" = $1`,
      [orgId],
    );
    const current = countRows[0]?.count ?? 0;

    if (current >= limits.maxAgents) {
      res.status(402).json({
        error: "Agent limit reached",
        plan,
        limit: limits.maxAgents,
        current,
        upgradeUrl: "/settings/billing",
      });
      return;
    }

    next();
  })().catch((err) => {
    console.error("enforceAgentLimit error:", err);
    // Fail open — don't block the request if the check itself errors
    next();
  });
}

// ── Middleware: enforce mission limit ────────────────────────────

/**
 * Blocks GLORB mission creation when the organization has reached or exceeded
 * the mission limit for its current plan.
 *
 * Attach to `POST /api/glorb/missions`.
 */
export function enforceMissionLimit(req: Request, res: Response, next: NextFunction): void {
  const orgId = resolveOrgId(req);

  if (!orgId) {
    return next();
  }

  (async () => {
    const plan = await getOrgPlan(orgId);
    const limits = getPlanLimits(plan);

    const countRows = await query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM "GlorbMission" WHERE "organizationId" = $1`,
      [orgId],
    );
    const current = countRows[0]?.count ?? 0;

    if (current >= limits.maxMissions) {
      res.status(402).json({
        error: "Mission limit reached",
        plan,
        limit: limits.maxMissions,
        current,
        upgradeUrl: "/settings/billing",
      });
      return;
    }

    next();
  })().catch((err) => {
    console.error("enforceMissionLimit error:", err);
    next();
  });
}
