type EnvironmentVariables = Record<string, unknown>;

const requiredVariables = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

export function validateOutboxWorkerEnvironment(
  variables: EnvironmentVariables,
): EnvironmentVariables {
  const missingVariables = requiredVariables.filter((name) => {
    const value = variables[name];

    return typeof value !== 'string' || value.trim().length === 0;
  });

  if (missingVariables.length > 0) {
    throw new Error(
      `Variables du worker manquantes : ${missingVariables.join(', ')}`,
    );
  }

  const url = String(variables.SUPABASE_URL);
  const serviceRoleKey = String(variables.SUPABASE_SERVICE_ROLE_KEY).trim();

  try {
    const parsedUrl = new URL(url);

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('unsupported protocol');
    }
  } catch {
    throw new Error('SUPABASE_URL doit être une URL HTTP valide.');
  }

  if (!isServiceRoleKey(serviceRoleKey)) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY doit contenir une clé privilégiée valide.',
    );
  }

  return variables;
}

function isServiceRoleKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true;

  const parts = key.split('.');
  if (parts.length !== 3 || !parts[1]) return false;

  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8'),
    ) as unknown;

    return (
      typeof payload === 'object' &&
      payload !== null &&
      'role' in payload &&
      payload.role === 'service_role'
    );
  } catch {
    return false;
  }
}
