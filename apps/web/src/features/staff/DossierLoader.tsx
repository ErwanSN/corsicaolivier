"use client";

import { useEffect, useState } from "react";
import { type Dossier } from "@corsica/contracts";

import { apiClient } from "../../lib/api-client";
import { DossierDetail } from "./DossierDetail";

export function DossierLoader({ id }: Readonly<{ id: string }>) {
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void apiClient
      .getDossier(undefined, id)
      .then((value) => {
        if (active) setDossier(value);
      })
      .catch(() => {
        if (active) setError("Impossible de charger ce dossier.");
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (error)
    return (
      <p className="p-6 text-center text-sm text-danger" role="alert">
        {error}
      </p>
    );
  if (!dossier)
    return (
      <p aria-live="polite" className="p-6 text-center text-sm text-muted">
        Chargement du dossier…
      </p>
    );
  return <DossierDetail dossier={dossier} />;
}
