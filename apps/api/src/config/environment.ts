export type Environment = Readonly<{
  nodeEnv: string;
  port: number;
  corsOrigins: string[];
  supabase: Readonly<{
    url: string;
    publishableKey: string;
  }>;
}>;

export function environment(): Environment {
  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.API_PORT ?? 3001),
    corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
      .split(',')
      .map((origin) => origin.trim()),
    supabase: {
      url: process.env.SUPABASE_URL ?? '',
      publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY ?? '',
    },
  };
}
