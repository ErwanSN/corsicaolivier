"use client";

import { useCallback, useState } from "react";

import { BrandSignature } from "../../components/brand/BrandSignature";
import { type AuthFormMode } from "./auth.types";
import { AuthBackground } from "./components/AuthBackground";
import { AuthDialog } from "./components/AuthDialog";
import { AuthWelcomeActions } from "./components/AuthWelcomeActions";

const contentClassName = [
  "relative z-[2] flex min-h-[100svh] flex-col",
  "[padding:calc(58px+env(safe-area-inset-top))_24px_calc(30px+env(safe-area-inset-bottom))]",
  "md:[padding:36px_clamp(32px,5vw,80px)_clamp(48px,7vh,84px)]",
  "min-[1200px]:[padding-left:clamp(64px,7vw,120px)] min-[1200px]:[padding-right:clamp(64px,7vw,120px)]"
].join(" ");

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
    <main className="relative min-h-[100svh] overflow-hidden bg-surface-inverse text-foreground">
      <h1 className="sr-only">Corsica Linea</h1>
      <AuthBackground />

      <div className={contentClassName}>
        <div className="self-center">
          <BrandSignature variant="header" />
        </div>

        <div className="flex flex-1 items-end justify-center md:items-center">
          <div className="w-full max-w-[300px] md:max-w-[304px]">
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
