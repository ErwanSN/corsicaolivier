import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor
} from "@nestjs/common";
import { type Observable, tap } from "rxjs";

import { AuthAttemptLimiter } from "./auth-rate-limit";
import { type RateLimitedRequest } from "./auth-rate-limit.guard";

@Injectable()
export class AuthRateLimitInterceptor implements NestInterceptor {
  constructor(private readonly limiter: AuthAttemptLimiter) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RateLimitedRequest>();
    return next.handle().pipe(
      tap(() => {
        if (request.authRateLimitKey) this.limiter.clear(request.authRateLimitKey);
      })
    );
  }
}
