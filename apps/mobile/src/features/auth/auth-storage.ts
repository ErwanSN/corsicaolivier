import { authSessionSchema, type AuthSessionDto } from "@corsica/contracts";
import * as SecureStore from "expo-secure-store";

const authTokenStorageKey = "corsica.auth.accessToken";
const refreshTokenStorageKey = "corsica.auth.refreshToken";
const sessionStorageKey = "corsica.auth.session.v2";

export async function readStoredTokens(): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
}> {
  const serializedSession = await SecureStore.getItemAsync(sessionStorageKey);
  if (serializedSession) {
    try {
      const session = authSessionSchema.parse(JSON.parse(serializedSession));
      return { accessToken: session.accessToken, refreshToken: session.refreshToken };
    } catch {
      await SecureStore.deleteItemAsync(sessionStorageKey);
    }
  }
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(authTokenStorageKey),
    SecureStore.getItemAsync(refreshTokenStorageKey)
  ]);
  return { accessToken, refreshToken };
}

export async function storeAuthSession(session: AuthSessionDto): Promise<void> {
  await SecureStore.setItemAsync(sessionStorageKey, JSON.stringify(session));
  await Promise.all([
    SecureStore.deleteItemAsync(authTokenStorageKey),
    SecureStore.deleteItemAsync(refreshTokenStorageKey)
  ]);
}

export async function clearStoredAuthSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(sessionStorageKey),
    SecureStore.deleteItemAsync(authTokenStorageKey),
    SecureStore.deleteItemAsync(refreshTokenStorageKey)
  ]);
}
