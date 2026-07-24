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

  const port = Number(variables.API_PORT ?? 3001);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('API_PORT doit être un port TCP valide.');
  }

  return variables;
}
