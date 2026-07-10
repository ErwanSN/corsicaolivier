"use client";

import { useCallback, useEffect, useState } from "react";
import { getApiClientErrorMessage } from "@corsica/api-client";

import { apiClient } from "../../lib/api-client";
import { useStoredAuthSession } from "../auth/use-stored-auth-session";
import {
  defaultPortMapConfig,
  type PortMapConfig,
  portMapStorageKey,
  readPortMapConfig
} from "./port-map-config";

type LoadStatus = "error" | "loading" | "ready";

export function usePortMapConfig() {
  const { session } = useStoredAuthSession();
  const [config, setConfig] = useState<PortMapConfig>(defaultPortMapConfig);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");

  const loadConfiguration = useCallback(async () => {
    setError(null);
    setStatus("loading");
    try {
      let remote = await apiClient.getPortMapConfiguration();
      const legacy = readPortMapConfig(window.localStorage.getItem(portMapStorageKey));
      if (
        remote.points.length === 0 &&
        legacy.points.length > 0 &&
        session?.user.role === "ADMIN"
      ) {
        remote = await apiClient.updatePortMapConfiguration(undefined, legacy);
        window.localStorage.removeItem(portMapStorageKey);
      }
      setConfig(remote);
      setStatus("ready");
    } catch (caught) {
      setError(getApiClientErrorMessage(caught));
      setStatus("error");
    }
  }, [session]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadConfiguration();
    });
  }, [loadConfiguration]);

  const saveConfig = useCallback(
    async (nextConfig: PortMapConfig): Promise<boolean> => {
      if (session?.user.role !== "ADMIN") {
        setError("Une session administrateur est requise.");
        return false;
      }
      setError(null);
      try {
        const saved = await apiClient.updatePortMapConfiguration(undefined, nextConfig);
        setConfig(saved);
        setStatus("ready");
        return true;
      } catch (caught) {
        setError(getApiClientErrorMessage(caught));
        return false;
      }
    },
    [session]
  );

  return { config, error, reload: loadConfiguration, saveConfig, status } as const;
}
