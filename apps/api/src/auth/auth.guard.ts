import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { SupabaseService } from '../database/supabase.service';
import type { AuthenticatedRequest, AuthIdentity } from './auth-context';
import { IS_PUBLIC_ROUTE } from './public.decorator';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabase: SupabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_ROUTE,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest & { auth?: AuthIdentity }>();
    const accessToken = this.extractBearerToken(request.headers.authorization);
    const { data, error } = await this.supabase.verifyAccessToken(accessToken);

    if (error || !data?.claims) {
      throw new UnauthorizedException('Jeton d’accès invalide ou expiré.');
    }

    const claims = data.claims;

    if (
      !UUID_PATTERN.test(claims.sub) ||
      claims.role !== 'authenticated' ||
      claims.is_anonymous === true ||
      claims.aal !== 'aal2'
    ) {
      throw new UnauthorizedException(
        'Une authentification à deux facteurs est requise.',
      );
    }

    request.auth = {
      accessToken,
      userId: claims.sub,
      ...(typeof claims.email === 'string' ? { email: claims.email } : {}),
      assuranceLevel: claims.aal,
    };

    return true;
  }

  private extractBearerToken(
    authorization: string | string[] | undefined,
  ): string {
    if (typeof authorization !== 'string' || authorization.length > 8192) {
      throw new UnauthorizedException('Authentification Bearer requise.');
    }

    const match = /^Bearer ([^\s]+)$/i.exec(authorization);

    if (!match?.[1]) {
      throw new UnauthorizedException('Authentification Bearer requise.');
    }

    return match[1];
  }
}
