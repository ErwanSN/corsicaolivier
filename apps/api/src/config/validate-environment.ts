import { assertSafePublishableKey } from './publishable-key';

type EnvironmentVariables = Record<string, unknown>;

const requiredVariables = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY'] as const;

export function validateEnvironment(
  variables: EnvironmentVariables,
): EnvironmentVariables {
  const missingVariables = requiredVariables.filter((name) => {
    const value = variables[name];

    return typeof value !== 'string' || value.trim().length === 0;
  });

  if (missingVariables.length > 0) {
    throw new Error(
      `Variables d'environnement manquantes : ${missingVariables.join(', ')}`,
    );
  }

  assertSafePublishableKey(String(variables.SUPABASE_PUBLISHABLE_KEY));

  const port = Number(variables.API_PORT ?? 3001);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('API_PORT doit être un port TCP valide.');
  }

  for (const variableName of ['SUPABASE_URL'] as const) {
    const value = String(variables[variableName]);

    try {
      const parsedUrl = new URL(value);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('unsupported protocol');
      }
    } catch {
      throw new Error(`${variableName} doit être une URL HTTP valide.`);
    }
  }

  const corsOriginValue = variables.CORS_ORIGIN ?? 'http://localhost:3000';

  if (typeof corsOriginValue !== 'string') {
    throw new Error('CORS_ORIGIN doit être une chaîne de caractères.');
  }

  const corsOrigins = corsOriginValue.split(',').map((origin) => origin.trim());

  if (
    corsOrigins.some((origin) => {
      try {
        const parsed = new URL(origin);
        return (
          !['http:', 'https:'].includes(parsed.protocol) ||
          parsed.origin !== origin ||
          origin === '*'
        );
      } catch {
        return true;
      }
    })
  ) {
    throw new Error(
      'CORS_ORIGIN doit contenir uniquement des origines HTTP exactes.',
    );
  }

  return variables;
}
