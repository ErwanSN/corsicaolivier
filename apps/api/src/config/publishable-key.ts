export function assertSafePublishableKey(key: string): void {
  const normalizedKey = key.trim();

  if (
    normalizedKey.startsWith('sb_secret_') ||
    readJwtRole(normalizedKey) === 'service_role'
  ) {
    throw new Error(
      'SUPABASE_PUBLISHABLE_KEY doit contenir une clé publiable non privilégiée.',
    );
  }
}

function readJwtRole(key: string): string | null {
  const parts = key.split('.');

  if (parts.length !== 3 || !parts[1]) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8'),
    ) as unknown;

    if (
      typeof payload === 'object' &&
      payload !== null &&
      'role' in payload &&
      typeof payload.role === 'string'
    ) {
      return payload.role;
    }
  } catch {
    return null;
  }

  return null;
}
