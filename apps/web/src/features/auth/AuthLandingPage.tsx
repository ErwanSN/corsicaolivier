"use client";

import { useCallback, useState } from "react";

import { BrandSignature } from "../../components/brand/BrandSignature";
import { type AuthFormMode } from "./auth.types";
import { AuthBackground } from "./components/AuthBackground";
import { AuthDialog } from "./components/AuthDialog";
import { AuthWelcomeActions } from "./components/AuthWelcomeActions";
import styles from "./AuthLandingPage.module.css";

export function AuthLandingPage() {
  const [authMode, setAuthMode] = useState<AuthFormMode | null>(null);

  const handleCreateAccount = useCallback(() => {
    setAuthMode("createAccount");
  }, []);

  const handleLogin = useCallback(() => {
    setAuthMode("signIn");
  }, []);

  const handleCloseAuth = useCallback(() => {
    setAuthMode(null);
  }, []);

  return (
    <main className={styles.root}>
      <AuthBackground />

      <div className={styles.content}>
        <div className={styles.topbar}>
          <BrandSignature variant="header" />
        </div>

        <div className={styles.stage}>
          <div className={styles.actionsSlot}>
            <AuthWelcomeActions onCreateAccount={handleCreateAccount} onLogin={handleLogin} />
          </div>
        </div>
      </div>

      {authMode ? (
        <AuthDialog mode={authMode} onClose={handleCloseAuth} onModeChange={setAuthMode} />
      ) : null}
    </main>
  );
}
