import { prisma } from "./prisma";

export { prisma };

/**
 * Backward-compatible query helper that wraps prisma.$queryRawUnsafe.
 *
 * Existing route handlers use:
 *   const rows = await query<MyType>("SELECT … WHERE id = $1", [id]);
 *
 * This shim preserves that contract so callers can migrate to typed
 * Prisma operations incrementally.
 */
export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
  if (params && params.length > 0) {
    const rows = await prisma.$queryRawUnsafe<T[]>(text, ...params);
    return rows;
  }
  const rows = await prisma.$queryRawUnsafe<T[]>(text);
  return rows;
}

/**
 * Backward-compatible pool-like object so callers that imported `pool`
 * (e.g. for pool.end() during shutdown) keep working.
 */
export const pool = {
  async end() {
    await prisma.$disconnect();
  },
};
