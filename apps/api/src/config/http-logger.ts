type LoggedRequest = Readonly<{
  id?: unknown;
  ip?: unknown;
  method?: unknown;
  url?: unknown;
}>;

type SanitizedRequest = Readonly<{
  id?: string;
  ip?: string;
  method?: string;
  path?: string;
}>;

export const FASTIFY_LOG_REDACTION_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'request.headers.authorization',
  'request.headers.cookie',
  'headers.authorization',
  'headers.cookie',
] as const;

export function createHttpLoggerOptions(nodeEnv: string) {
  if (nodeEnv === 'test') {
    return false as const;
  }

  return {
    redact: {
      censor: '[REDACTED]',
      paths: [...FASTIFY_LOG_REDACTION_PATHS],
    },
    serializers: {
      req: sanitizeLoggedRequest,
    },
  };
}

export function sanitizeLoggedRequest(
  request: LoggedRequest,
): SanitizedRequest {
  return {
    ...(typeof request.id === 'string' ? { id: request.id } : {}),
    ...(typeof request.method === 'string' ? { method: request.method } : {}),
    ...(typeof request.url === 'string'
      ? { path: request.url.split(/[?#]/, 1)[0] }
      : {}),
    ...(typeof request.ip === 'string' ? { ip: request.ip } : {}),
  };
}
