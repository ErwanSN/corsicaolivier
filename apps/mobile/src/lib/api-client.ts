import { CorsicaApiClient } from "@corsica/api-client";
import Constants from "expo-constants";

export const apiClient = new CorsicaApiClient({
  baseUrl: resolveApiBaseUrl()
});

function resolveApiBaseUrl(): string {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

  if (configuredUrl) {
    return configuredUrl;
  }

  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(":")[0];

  return host ? `http://${host}:3001` : "http://localhost:3001";
}
