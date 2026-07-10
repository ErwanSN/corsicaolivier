import { HttpException, HttpStatus, Injectable } from "@nestjs/common";

const maximumFailures = 5;
const maximumTrackedKeys = 10_000;
const windowMilliseconds = 60_000;

type Attempt = Readonly<{ count: number; expiresAt: number }>;
export type RateLimitDecision =
  Readonly<{ allowed: true }> | Readonly<{ allowed: false; retryAfterSeconds: number }>;

@Injectable()
export class AuthAttemptLimiter {
  private readonly attempts = new Map<string, Attempt>();

  consume(key: string, now = Date.now()): RateLimitDecision {
    const current = this.attempts.get(key);
    if (!current || current.expiresAt <= now) {
      this.ensureCapacity(now);
      this.attempts.set(key, { count: 1, expiresAt: now + windowMilliseconds });
      return { allowed: true };
    }
    if (current.count >= maximumFailures) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((current.expiresAt - now) / 1000))
      };
    }
    this.attempts.set(key, { ...current, count: current.count + 1 });
    return { allowed: true };
  }

  clear(key: string): void {
    this.attempts.delete(key);
  }

  get trackedKeys(): number {
    return this.attempts.size;
  }

  private ensureCapacity(now: number): void {
    if (this.attempts.size < maximumTrackedKeys) return;
    for (const [key, attempt] of this.attempts) {
      if (attempt.expiresAt <= now) this.attempts.delete(key);
    }
    while (this.attempts.size >= maximumTrackedKeys) {
      const oldestKey = this.attempts.keys().next().value;
      if (!oldestKey) return;
      this.attempts.delete(oldestKey);
    }
  }
}

export function authLoginRateLimitKey(ip: string, body: unknown): string {
  return `${ip}:${readIdentifier(body)}`;
}

export function authRateLimitException(): HttpException {
  return new HttpException(
    {
      code: "AUTH_RATE_LIMIT_EXCEEDED",
      message: "Trop de tentatives de connexion. Réessayez dans une minute."
    },
    HttpStatus.TOO_MANY_REQUESTS
  );
}

function readIdentifier(body: unknown): string {
  if (
    typeof body === "object" &&
    body !== null &&
    "identifier" in body &&
    typeof body.identifier === "string"
  ) {
    return body.identifier.trim().toLowerCase();
  }
  return "invalid-payload";
}
