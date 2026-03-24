import type { Request, Response, NextFunction } from "express";

/**
 * Lightweight JWT auth middleware for Clerk tokens.
 *
 * Behaviour:
 *  - Extracts Bearer token from the Authorization header.
 *  - If no token is present and AUTH_REQUIRED !== "true", the request is
 *    allowed through (convenient for local dev without Clerk).
 *  - If a token is present, validates that it looks like a well-formed JWT
 *    (three base64url-encoded segments) and attaches the decoded payload to
 *    `req.auth`.
 *  - Full cryptographic JWKS verification can be layered in later.
 */

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
      auth?: JwtPayload;
    }
  }
}

function isBase64Url(s: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(s);
}

function decodeJwtPayload(token: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  if (!parts.every(isBase64Url)) return null;

  try {
    // Base64url → Base64 → Buffer → JSON
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(base64, "base64").toString("utf-8");
    const payload = JSON.parse(json);
    if (typeof payload !== "object" || payload === null) return null;
    return payload as JwtPayload;
  } catch {
    return null;
  }
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
    // Dev mode — allow unauthenticated requests
    return next();
  }

  // Token present — validate structure and decode
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

  req.auth = payload;
  next();
}
