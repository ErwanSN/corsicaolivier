import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

import type { SupabaseService } from '../database/supabase.service';
import { AuthGuard } from './auth.guard';

const userId = '43000000-0000-4000-8000-000000000001';

function context(authorization = 'Bearer access-token') {
  const request: {
    headers: { authorization?: string };
    auth?: unknown;
  } = { headers: { authorization } };

  return {
    request,
    execution: {
      getClass: () => class TestController {},
      getHandler: () => () => undefined,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext,
  };
}

function guardWithClaims(aal: 'aal1' | 'aal2') {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(false),
  } as unknown as Reflector;
  const supabase = {
    verifyAccessToken: jest.fn().mockResolvedValue({
      data: {
        claims: {
          aal,
          email: 'operator@example.invalid',
          is_anonymous: false,
          role: 'authenticated',
          sub: userId,
        },
      },
      error: null,
    }),
  } as unknown as SupabaseService;

  return new AuthGuard(reflector, supabase);
}

describe('AuthGuard', () => {
  it('laisse la santé explicitement publique sans demander de jeton', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(true),
    } as unknown as Reflector;
    const verifyAccessToken = jest.fn();
    const guard = new AuthGuard(reflector, {
      verifyAccessToken,
    } as unknown as SupabaseService);
    const testContext = context('');

    await expect(guard.canActivate(testContext.execution)).resolves.toBe(true);
    expect(verifyAccessToken).not.toHaveBeenCalled();
  });

  it('refuse un jeton humain aal1 avant tout accès métier', async () => {
    const guard = guardWithClaims('aal1');
    const testContext = context();

    await expect(guard.canActivate(testContext.execution)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(testContext.request.auth).toBeUndefined();
  });

  it('accepte aal2 et transmet uniquement le contexte vérifié', async () => {
    const guard = guardWithClaims('aal2');
    const testContext = context();

    await expect(guard.canActivate(testContext.execution)).resolves.toBe(true);
    expect(testContext.request.auth).toEqual({
      accessToken: 'access-token',
      assuranceLevel: 'aal2',
      email: 'operator@example.invalid',
      userId,
    });
  });
});
