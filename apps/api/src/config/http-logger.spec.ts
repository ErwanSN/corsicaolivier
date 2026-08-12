import {
  createHttpLoggerOptions,
  FASTIFY_LOG_REDACTION_PATHS,
  sanitizeLoggedRequest,
} from './http-logger';

describe('configuration des logs HTTP', () => {
  it('retire la query string et ne sérialise aucun en-tête', () => {
    const authorization = 'Bearer forbidden-test-token';
    const serialized = sanitizeLoggedRequest({
      id: 'request-1',
      ip: '192.0.2.1',
      method: 'GET',
      url: '/api/agents?search=nom-sensible&token=forbidden-test-token',
      headers: { authorization },
    } as never);
    const output = JSON.stringify(serialized);

    expect(serialized).toEqual({
      id: 'request-1',
      ip: '192.0.2.1',
      method: 'GET',
      path: '/api/agents',
    });
    expect(output).not.toContain('nom-sensible');
    expect(output).not.toContain(authorization);
  });

  it('applique une redaction défensive aux credentials', () => {
    expect(FASTIFY_LOG_REDACTION_PATHS).toEqual(
      expect.arrayContaining([
        'req.headers.authorization',
        'req.headers.cookie',
      ]),
    );
    expect(createHttpLoggerOptions('test')).toBe(false);
    expect(createHttpLoggerOptions('production')).toMatchObject({
      redact: { censor: '[REDACTED]' },
    });
  });
});
