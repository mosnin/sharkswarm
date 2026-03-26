import type { Request, Response, NextFunction } from "express";
import type { OrgContext } from "../auth";

/**
 * Middleware that validates the request has a resolved organization context.
 * Should be placed after `requireAuth` on routes that need org-scoping.
 */
export function requireOrg(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth?.organizationId) {
    res.status(403).json({ error: "Organization context required" });
    return;
  }
  next();
}

/**
 * Helper to extract the organizationId from the request's auth context.
 * Throws if no org context is present (should only be called after requireAuth
 * and/or requireOrg middleware).
 */
export function getOrgId(req: Request): string {
  const orgId = req.auth?.organizationId;
  if (!orgId) {
    throw new Error("No organizationId on request — is requireAuth middleware applied?");
  }
  return orgId;
}

/**
 * Helper to extract the full OrgContext from the request.
 * Throws if no auth context is present.
 */
export function getOrgContext(req: Request): OrgContext {
  if (!req.auth) {
    throw new Error("No auth context on request — is requireAuth middleware applied?");
  }
  return req.auth;
}
