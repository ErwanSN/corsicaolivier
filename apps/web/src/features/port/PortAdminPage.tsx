"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

import { useStoredAuthSession } from "../auth/use-stored-auth-session";
import { usePortMapConfig } from "./use-port-map-config";

const PortAdminEditor = dynamic(
  () => import("./PortAdminEditor").then((module) => module.PortAdminEditor),
  { ssr: false }
);

export function PortAdminPage() {
  const router = useRouter();
  const { session, status } = useStoredAuthSession();
  const { config, error, saveConfig, status: mapStatus } = usePortMapConfig();

  if (status === "loading") {
    return (
      <p className="p-8 text-center text-[14px] text-muted" role="status">
        Vérification de la session…
      </p>
    );
  }

  if (session?.user.role !== "ADMIN") {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Accès administrateur requis</h1>
        <p className="mt-3 text-[14px] text-muted">
          Connectez-vous avec un compte administrateur pour modifier la carte du port.
        </p>
      </div>
    );
  }

  if (mapStatus === "loading") {
    return (
      <p className="p-8 text-center text-[14px] text-muted" role="status">
        Chargement de la configuration du port…
      </p>
    );
  }

  return (
    <PortAdminEditor
      config={config}
      onClose={() => {
        router.push("/port");
      }}
      error={error}
      onSave={async (nextConfig) => {
        const saved = await saveConfig(nextConfig);
        if (saved) router.push("/port");
        return saved;
      }}
    />
  );
}
