export function resolveApiBaseUrl(
  configuredUrl: string | undefined,
  expoHostUri: string | undefined
): string {
  const configured = configuredUrl?.trim();
  if (configured) return configured;
  if (!expoHostUri) return "http://localhost:3001";
  try {
    const url = new URL(expoHostUri.includes("://") ? expoHostUri : `http://${expoHostUri}`);
    return `http://${url.hostname}:3001`;
  } catch {
    return "http://localhost:3001";
  }
}
