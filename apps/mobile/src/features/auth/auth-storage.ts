import { type AuthSessionDto } from "@corsica/contracts";
import * as SecureStore from "expo-secure-store";

const authTokenStorageKey = "corsica.auth.accessToken";
const refreshTokenStorageKey = "corsica.auth.refreshToken";

export async function readStoredTokens(): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
}> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(authTokenStorageKey),
    SecureStore.getItemAsync(refreshTokenStorageKey)
  ]);
  return { accessToken, refreshToken };
}

export async function storeAuthSession(session: AuthSessionDto): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(authTokenStorageKey, session.accessToken),
    SecureStore.setItemAsync(refreshTokenStorageKey, session.refreshToken)
  ]);
}

export async function clearStoredAuthSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(authTokenStorageKey),
    SecureStore.deleteItemAsync(refreshTokenStorageKey)
  ]);
}
