"use client";

import { useEffect, useState } from "react";
import { type ControlRecord } from "@corsica/contracts";

import { apiClient } from "../../lib/api-client";
import { ControlHistoryItem } from "./ControlHistoryItem";

export function ControlHistoryView() {
  const [controls, setControls] = useState<ControlRecord[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    void apiClient
      .getControlHistory()
      .then((records) => {
        if (active) setControls(records);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6">
      <h1 className="text-[22px] font-bold text-foreground">Historique des contrôles</h1>
      <p aria-live="polite" className="mt-1 text-[14px] text-muted">
        {controls ? `${String(controls.length)} contrôles enregistrés` : "Chargement…"}
      </p>

      <div className="mt-5 flex flex-col gap-2.5">
        {error ? (
          <p className="text-sm text-danger" role="alert">
            Historique indisponible.
          </p>
        ) : null}
        {controls?.length === 0 ? (
          <p className="text-sm text-muted">Aucun contrôle enregistré.</p>
        ) : null}
        {controls?.map((control) => (
          <ControlHistoryItem control={control} key={control.id} />
        ))}
      </div>
    </div>
  );
}
