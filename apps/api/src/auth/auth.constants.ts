import { type ConfigService } from "@nestjs/config";

const localDevelopmentSecret = "corsica-local-auth-secret-change-before-production";

export function getAuthJwtSecret(configService: ConfigService): string {
  const configuredSecret = configService.get<string>("AUTH_JWT_SECRET");

  if (configuredSecret) {
    return configuredSecret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_JWT_SECRET must be set in production.");
  }

  return localDevelopmentSecret;
}

export const accessTokenExpiresIn = "15m";
export const accessTokenMaxAgeSeconds = 15 * 60;
export const refreshTokenMaxAgeSeconds = 30 * 24 * 60 * 60;
export const accessCookieName = "corsica_session";
export const refreshCookieName = "corsica_refresh";
