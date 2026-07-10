"use client";

import { Check, Printer, X } from "lucide-react";
import { useState } from "react";
import { type ControlStatus } from "@corsica/contracts";

import { apiClient } from "../../lib/api-client";

export function ControlActions({ dossierId }: Readonly<{ dossierId: string }>) {
  const [saving, setSaving] = useState<ControlStatus | null>(null);
  const [result, setResult] = useState<ControlStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function record(status: ControlStatus): Promise<void> {
    setSaving(status);
    setError(null);
    try {
      await apiClient.createControl(undefined, { dossierId, status });
      setResult(status);
    } catch {
      setError("Le contrôle n’a pas pu être enregistré.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="mt-auto space-y-3 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] print:hidden">
      {result ? (
        <p aria-live="polite" className="text-center text-sm font-medium text-foreground">
          Contrôle {result === "valide" ? "validé" : "refusé"} et enregistré.
        </p>
      ) : null}
      {error ? (
        <p className="text-center text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <button
          className="focus-ring flex min-h-12 items-center justify-center gap-2 rounded-full border border-danger/30 text-sm font-semibold text-danger"
          disabled={saving !== null}
          onClick={() => void record("refuse")}
          type="button"
        >
          <X aria-hidden="true" className="size-4" /> Refuser
        </button>
        <button
          className="focus-ring flex min-h-12 items-center justify-center gap-2 rounded-full bg-emerald-600 text-sm font-semibold text-white disabled:opacity-50"
          disabled={saving !== null}
          onClick={() => void record("valide")}
          type="button"
        >
          <Check aria-hidden="true" className="size-4" /> Valider
        </button>
      </div>
      <button
        className="focus-ring flex w-full items-center justify-center gap-2 rounded-full bg-surface-inverse py-4 text-[15px] font-semibold text-background transition hover:opacity-90"
        onClick={() => {
          window.print();
        }}
        type="button"
      >
        <Printer aria-hidden="true" className="size-4" /> Imprimer le dossier
      </button>
    </div>
  );
}
