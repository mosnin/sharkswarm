"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback } from "react";
import { authApi } from "@/lib/api";

/**
 * Hook that provides an authenticated API caller.
 * Automatically attaches the Clerk session token.
 */
export function useAuthApi() {
  const { getToken } = useAuth();

  const call = useCallback(
    async <T>(path: string, options?: RequestInit): Promise<T> => {
      const token = await getToken();
      return authApi<T>(path, token, options);
    },
    [getToken]
  );

  return call;
}
