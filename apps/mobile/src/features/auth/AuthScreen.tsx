import { type AuthSessionDto } from "@corsica/contracts";
import { useCallback, useEffect, useState } from "react";
import { ImageBackground, StatusBar, StyleSheet, View } from "react-native";

import { brandImages } from "../../assets/brand-images";
import { BrandSignature } from "../../components/brand/BrandSignature";
import { theme } from "../../design-system/theme";
import { apiClient } from "../../lib/api-client";
import { clearStoredAuthSession, readStoredAccessToken, storeAuthSession } from "./auth-storage";
import { type AuthFormMode, type AuthSubmitHandler } from "./auth.types";
import { AuthWelcomeActions } from "./components/AuthWelcomeActions";
import { AuthFormScreen } from "./components/AuthFormScreen";
import { AuthSessionCard } from "./components/AuthSessionCard";

type AuthMode = AuthFormMode | "welcome";

export function AuthScreen() {
  const [authMode, setAuthMode] = useState<AuthMode>("welcome");
  const [session, setSession] = useState<AuthSessionDto | null>(null);
  const formMode = authMode === "welcome" ? null : authMode;

  useEffect(() => {
    let isActive = true;

    async function hydrateSession(): Promise<void> {
      const storedAccessToken = await readStoredAccessToken();

      if (!storedAccessToken) {
        return;
      }

      try {
        const user = await apiClient.me(storedAccessToken);

        if (isActive) {
          setSession({
            accessToken: storedAccessToken,
            tokenType: "Bearer",
            user
          });
        }
      } catch {
        await clearStoredAuthSession();
      }
    }

    void hydrateSession();

    return () => {
      isActive = false;
    };
  }, []);

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
          : await apiClient.login(credentials);

      await storeAuthSession(nextSession);
      setSession(nextSession);
      setAuthMode("welcome");
    },
    [authMode]
  );

  const handleLogout = useCallback(() => {
    void clearStoredAuthSession();
    setSession(null);
    setAuthMode("welcome");
  }, []);

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
  }
});
