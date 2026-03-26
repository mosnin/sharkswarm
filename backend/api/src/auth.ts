import type { Request, Response, NextFunction } from "express";
import { query } from "./db";

/**
 * Lightweight JWT auth middleware for Clerk tokens.
 *
 * Behaviour:
 *  - Extracts Bearer token from the Authorization header.
 *  - If no token is present and AUTH_REQUIRED !== "true", the request is
 *    allowed through with a default dev context.
 *  - If a token is present, validates that it looks like a well-formed JWT
 *    (three base64url-encoded segments), decodes the payload, then looks up
 *    the user's organization via the User + Membership tables.
 *  - Attaches an OrgContext to `req.auth` with userId, clerkId,
 *    organizationId, and role.
 *  - Full cryptographic JWKS verification can be layered in later.
 */

export interface OrgContext {
  /** Internal database user ID (UUID) */
  userId: string;
  /** Clerk user ID (sub claim) */
  clerkId: string;
  /** Active organization ID (UUID) */
  organizationId: string;
  /** User's role within the organization */
  role: string;
}

export interface JwtPayload {
  sub?: string;
  iss?: string;
  exp?: number;
  iat?: number;
  [key: string]: unknown;
}

// Extend Express Request so downstream handlers can access `req.auth`
declare global {
  namespace Express {
    interface Request {
      auth?: OrgContext;
    }
  }
}

/** Default fallback org ID used in dev mode when no JWT is provided. */
const DEV_FALLBACK_ORG_ID = "00000000-0000-0000-0000-000000000000";

function isBase64Url(s: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(s);
}

function decodeJwtPayload(token: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  if (!parts.every(isBase64Url)) return null;

  try {
    // Base64url -> Base64 -> Buffer -> JSON
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(base64, "base64").toString("utf-8");
    const payload = JSON.parse(json);
    if (typeof payload !== "object" || payload === null) return null;
    return payload as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Look up the user by their Clerk ID and find their active membership.
 * Returns an OrgContext on success, or null if user/membership not found.
 */
async function resolveOrgContext(clerkId: string): Promise<OrgContext | null> {
  // Query User by clerkId
  const users = await query<{ id: string }>(
    `SELECT "id" FROM "User" WHERE "clerkId" = $1 LIMIT 1`,
    [clerkId],
  );
  if (!users.length) return null;

  const userId = users[0].id;

  // Find active membership to get organizationId and role
  const memberships = await query<{ organizationId: string; role: string }>(
    `SELECT "organizationId", "role" FROM "Membership"
     WHERE "userId" = $1 AND "status" = 'active'
     ORDER BY "createdAt" ASC
     LIMIT 1`,
    [userId],
  );
  if (!memberships.length) return null;

  return {
    userId,
    clerkId,
    organizationId: memberships[0].organizationId,
    role: memberships[0].role,
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    // No token provided
    if (process.env.AUTH_REQUIRED === "true") {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    // Dev mode -- allow unauthenticated requests with a default context
    req.auth = {
      userId: "dev-user",
      clerkId: "dev-clerk-id",
      organizationId: DEV_FALLBACK_ORG_ID,
      role: "owner",
    };
    return next();
  }

  // Token present -- validate structure and decode
  const payload = decodeJwtPayload(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid token format" });
    return;
  }

  // Check expiration if present
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    res.status(401).json({ error: "Token expired" });
    return;
  }

  const clerkId = payload.sub;
  if (!clerkId) {
    res.status(401).json({ error: "Token missing subject (sub) claim" });
    return;
  }

  // Look up the user and their organization
  resolveOrgContext(clerkId)
    .then((ctx) => {
      if (!ctx) {
        res.status(403).json({ error: "No active organization found for user" });
        return;
      }
      req.auth = ctx;
      next();
    })
    .catch((err) => {
      console.error("Auth org resolution error:", err);
      res.status(500).json({ error: "Failed to resolve user organization" });
    });
}
