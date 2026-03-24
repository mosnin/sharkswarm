"use client";

import { useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { api } from "./api";

/**
 * Hook that returns an `api` function with the Clerk session token
 * automatically injected into every request.
 */
export function useApi() {
  const { getToken } = useAuth();

  const authedApi = useCallback(
    async <T>(path: string, options?: RequestInit): Promise<T> => {
      const token = await getToken();
      return api<T>(path, { ...options, token });
    },
    [getToken]
  );

  return authedApi;
}
