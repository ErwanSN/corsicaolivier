const weakSecretFragments = ["change-me", "local-auth-secret"];

export function validateRuntimeConfiguration(env: NodeJS.ProcessEnv): void {
  const errors = [
    validateEnvironment(env.NODE_ENV),
    validateInteger("API_PORT", env.API_PORT, 1, 65_535),
    validateInteger("API_INSTANCE_COUNT", env.API_INSTANCE_COUNT, 1, 1_000),
    validateInteger("BACKUP_RETENTION", env.BACKUP_RETENTION, 1, 10_000),
    validateBoolean("TRUST_PROXY", env.TRUST_PROXY),
    validateUrl("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT", env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT, false)
  ].filter((error): error is string => Boolean(error));

  if (env.NODE_ENV === "production") errors.push(...validateProductionConfiguration(env));
  const instanceCount = Number.parseInt(env.API_INSTANCE_COUNT ?? "1", 10);
  if ((env.DATABASE_URL ?? "file:./prisma/local.db").startsWith("file:") && instanceCount > 1) {
    errors.push("API_INSTANCE_COUNT must be 1 when DATABASE_URL uses SQLite.");
  }
  if (errors.length > 0)
    throw new Error(`Invalid runtime configuration:\n- ${errors.join("\n- ")}`);
}

function validateProductionConfiguration(env: NodeJS.ProcessEnv): string[] {
  const errors: (string | null)[] = [
    validateSecret("AUTH_JWT_SECRET", env.AUTH_JWT_SECRET),
    validateSecret("METRICS_TOKEN", env.METRICS_TOKEN),
    validateRequiredHttpsUrl("APP_PUBLIC_URL", env.APP_PUBLIC_URL),
    validateRequiredHttpsUrl("API_PUBLIC_URL", env.API_PUBLIC_URL),
    env.DATABASE_URL ? null : "DATABASE_URL is required in production."
  ];
  const origins =
    env.CORS_ORIGIN?.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean) ?? [];
  if (origins.length === 0) errors.push("CORS_ORIGIN is required in production.");
  origins.forEach((origin) => {
    const error = validateUrl("CORS_ORIGIN", origin, true);
    if (error) errors.push(error);
  });
  return errors.filter((error): error is string => Boolean(error));
}

function validateEnvironment(value: string | undefined): string | null {
  return value === undefined || ["development", "production", "test"].includes(value)
    ? null
    : "NODE_ENV must be development, test or production.";
}

function validateSecret(name: string, value: string | undefined): string | null {
  if (
    !value ||
    value.length < 32 ||
    weakSecretFragments.some((fragment) => value.includes(fragment))
  ) {
    return `${name} must contain at least 32 non-placeholder characters in production.`;
  }
  return null;
}

function validateInteger(
  name: string,
  value: string | undefined,
  minimum: number,
  maximum: number
): string | null {
  if (value === undefined) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? null
    : `${name} must be an integer between ${String(minimum)} and ${String(maximum)}.`;
}

function validateBoolean(name: string, value: string | undefined): string | null {
  return value === undefined || value === "true" || value === "false"
    ? null
    : `${name} must be true or false.`;
}

function validateUrl(
  name: string,
  value: string | undefined,
  requireHttps: boolean
): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (requireHttps && url.protocol !== "https:") return `${name} must use HTTPS in production.`;
    return url.protocol === "http:" || url.protocol === "https:"
      ? null
      : `${name} must use HTTP or HTTPS.`;
  } catch {
    return `${name} must be a valid absolute URL.`;
  }
}

function validateRequiredHttpsUrl(name: string, value: string | undefined): string | null {
  return value ? validateUrl(name, value, true) : `${name} is required in production.`;
}
