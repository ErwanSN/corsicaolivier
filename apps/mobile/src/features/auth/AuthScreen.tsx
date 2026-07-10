import { type AuthSessionDto } from "@corsica/contracts";
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { ActivityIndicator, ImageBackground, StatusBar, StyleSheet, View } from "react-native";

import { brandImages } from "../../assets/brand-images";
import { BrandSignature } from "../../components/brand/BrandSignature";
import { theme } from "../../design-system/theme";
import { apiClient } from "../../lib/api-client";
import { clearStoredAuthSession, readStoredTokens, storeAuthSession } from "./auth-storage";
import { type AuthFormMode, type AuthSubmitHandler } from "./auth.types";
import { AuthWelcomeActions } from "./components/AuthWelcomeActions";
import { AuthFormScreen } from "./components/AuthFormScreen";
import { AuthSessionCard } from "./components/AuthSessionCard";

type AuthMode = AuthFormMode | "welcome";

export function AuthScreen() {
  const [authMode, setAuthMode] = useState<AuthMode>("welcome");
  const [session, setSession] = useState<AuthSessionDto | null>(null);
  const formMode = authMode === "welcome" ? null : authMode;
  const hydrated = useHydrateMobileSession(setSession);

  const handleCreateAccount = useCallback(() => {
    setAuthMode("createAccount");
  }, []);

  const handleLogin = useCallback(() => {
    setAuthMode("signIn");
  }, []);

  const handleDismiss = useCallback(() => {
    setAuthMode("welcome");
  }, []);

  const handleSwitchMode = useCallback((nextMode: AuthFormMode) => {
    setAuthMode(nextMode);
  }, []);

  const handleAuthSubmit = useCallback<AuthSubmitHandler>(
    async (credentials) => {
      if (authMode === "welcome") {
        return;
      }

      const nextSession =
        authMode === "createAccount"
          ? await apiClient.register(credentials)
          : await apiClient.login({
              identifier: credentials.email,
              password: credentials.password
            });

      await storeAuthSession(nextSession);
      setSession(nextSession);
      setAuthMode("welcome");
    },
    [authMode]
  );

  const handleLogout = useCallback(() => {
    if (session) void apiClient.logout(session.refreshToken).catch(() => undefined);
    void clearStoredAuthSession().catch(() => undefined);
    setSession(null);
    setAuthMode("welcome");
  }, [session]);

  if (!hydrated)
    return (
      <View accessibilityLabel="Restauration de la session" style={styles.loader}>
        <ActivityIndicator color={theme.colors.brand} size="large" />
      </View>
    );

  if (formMode) {
    return (
      <AuthFormScreen
        key={formMode}
        mode={formMode}
        onBack={handleDismiss}
        onSubmit={handleAuthSubmit}
        onSwitchMode={handleSwitchMode}
      />
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />

      <ImageBackground
        accessibilityLabel={brandImages.authBackground.alt}
        resizeMode="cover"
        source={brandImages.authBackground.source}
        style={styles.background}
      >
        <View pointerEvents="box-none" style={styles.content}>
          <BrandSignature variant="header" />

          {session ? (
            <AuthSessionCard onLogout={handleLogout} session={session} />
          ) : (
            <AuthWelcomeActions onCreateAccount={handleCreateAccount} onLogin={handleLogin} />
          )}
        </View>
      </ImageBackground>
    </View>
  );
}

function useHydrateMobileSession(
  setSession: Dispatch<SetStateAction<AuthSessionDto | null>>
): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    let isActive = true;
    async function hydrate(): Promise<void> {
      try {
        const restoredSession = await restoreMobileSession();
        if (isActive) setSession(restoredSession);
      } catch {
        await clearStoredAuthSession().catch(() => undefined);
      } finally {
        if (isActive) setHydrated(true);
      }
    }
    void hydrate();
    return () => {
      isActive = false;
    };
  }, [setSession]);
  return hydrated;
}

async function restoreMobileSession(): Promise<AuthSessionDto | null> {
  const { accessToken, refreshToken } = await readStoredTokens();
  if (!accessToken || !refreshToken) {
    await clearStoredAuthSession();
    return null;
  }
  try {
    const user = await apiClient.me(accessToken);
    return { accessToken, refreshToken, tokenType: "Bearer", user };
  } catch {
    return refreshMobileSession(refreshToken);
  }
}

async function refreshMobileSession(refreshToken: string): Promise<AuthSessionDto | null> {
  try {
    const refreshed = await apiClient.refresh(refreshToken);
    await storeAuthSession(refreshed);
    return refreshed;
  } catch {
    await clearStoredAuthSession();
    return null;
  }
}

const styles = StyleSheet.create({
  background: {
    flex: 1
  },
  content: {
    alignItems: "center",
    flex: 1,
    justifyContent: "space-between",
    paddingBottom: 30,
    paddingHorizontal: theme.spacing[6],
    paddingTop: 58
  },
  root: {
    backgroundColor: theme.colors.foreground,
    flex: 1
  },
  loader: {
    alignItems: "center",
    backgroundColor: theme.colors.background,
    flex: 1,
    justifyContent: "center"
  }
});
