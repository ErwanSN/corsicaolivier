import { CorsicaApiClient } from "@corsica/api-client";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const apiClient = new CorsicaApiClient({
  baseUrl: apiBaseUrl
});
