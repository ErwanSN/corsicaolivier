export function assertSafePublishableKey(key: string): void {
  const normalizedKey = key.trim();

  if (
    normalizedKey.startsWith('sb_secret_') ||
    readJwtRole(normalizedKey) === 'service_role'
  ) {
    throw new Error(
      'La configuration Supabase publique contient une clé privilégiée.',
    );
  }
}

function readJwtRole(key: string): string | null {
  const parts = key.split('.');

  if (parts.length !== 3 || !parts[1]) {
    return null;
  }

  try {
    const base64 = parts[1]
      .replaceAll('-', '+')
      .replaceAll('_', '/')
      .padEnd(Math.ceil(parts[1].length / 4) * 4, '=');
    const payload = JSON.parse(atob(base64)) as unknown;

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
