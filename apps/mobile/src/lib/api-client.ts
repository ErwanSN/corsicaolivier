import { CorsicaApiClient } from "@corsica/api-client";
import Constants from "expo-constants";

import { resolveApiBaseUrl } from "./api-base-url";

export const apiClient = new CorsicaApiClient({
  baseUrl: resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_URL, Constants.expoConfig?.hostUri)
});
