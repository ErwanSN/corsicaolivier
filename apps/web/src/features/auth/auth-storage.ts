import { type AuthSessionDto } from "@corsica/contracts";

const authTokenStorageKey = "corsica.auth.accessToken";

export function readStoredAccessToken(): string | null {
  return window.localStorage.getItem(authTokenStorageKey);
}

export function storeAuthSession(session: AuthSessionDto): void {
  window.localStorage.setItem(authTokenStorageKey, session.accessToken);
}

export function clearStoredAuthSession(): void {
  window.localStorage.removeItem(authTokenStorageKey);
}
