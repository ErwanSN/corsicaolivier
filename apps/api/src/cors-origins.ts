export function resolveCorsOrigins(
  nodeEnvironment: string | undefined,
  configuredOrigins: string | undefined
): false | string[] {
  const configured = configuredOrigins
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (configured && configured.length > 0) return [...new Set(configured)];
  return nodeEnvironment === "production"
    ? false
    : ["http://localhost:3000", "http://127.0.0.1:3000"];
}
