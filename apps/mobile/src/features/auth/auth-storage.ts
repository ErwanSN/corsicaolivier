import { type AuthSessionDto } from "@corsica/contracts";
import * as SecureStore from "expo-secure-store";

const authTokenStorageKey = "corsica.auth.accessToken";

export function readStoredAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(authTokenStorageKey);
}

export function storeAuthSession(session: AuthSessionDto): Promise<void> {
  return SecureStore.setItemAsync(authTokenStorageKey, session.accessToken);
}

export function clearStoredAuthSession(): Promise<void> {
  return SecureStore.deleteItemAsync(authTokenStorageKey);
}
