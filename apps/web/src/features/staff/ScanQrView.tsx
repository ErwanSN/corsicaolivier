"use client";

import { Camera, QrCode, Search, Square } from "lucide-react";
import { useState, type SyntheticEvent } from "react";

import { useQrScanner } from "./use-qr-scanner";

export function ScanQrView() {
  const { error, resolveReference, scanning, start, stop, videoRef } = useQrScanner();
  const [reference, setReference] = useState("");
  const [resolving, setResolving] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  async function submit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (reference.trim().length < 2) return;
    setResolving(true);
    setManualError(null);
    try {
      await resolveReference(reference);
    } catch {
      setManualError("Aucun dossier ne correspond à cette référence.");
    } finally {
      setResolving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col px-4 py-6">
      <h1 className="text-[22px] font-bold text-foreground">Scanner un QR code</h1>
      <p className="mt-1 text-[14px] text-muted">Scannez le billet ou saisissez sa référence.</p>

      <div className="relative mt-6 aspect-square w-full overflow-hidden bg-surface-inverse">
        <video
          aria-label="Aperçu de la caméra"
          className="size-full object-cover"
          muted
          playsInline
          ref={videoRef}
        />
        {!scanning ? (
          <div className="absolute inset-0 grid place-items-center">
            <QrCode aria-hidden="true" className="size-16 text-white/50" />
          </div>
        ) : null}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-1/2 size-56 -translate-1/2 border-2 border-white/70"
        />
      </div>

      <button
        className="focus-ring mt-4 flex min-h-12 items-center justify-center gap-2 rounded-full bg-surface-inverse text-sm font-semibold text-background"
        onClick={
          scanning
            ? stop
            : () => {
                void start();
              }
        }
        type="button"
      >
        {scanning ? <Square className="size-4" /> : <Camera className="size-4" />}
        {scanning ? "Arrêter la caméra" : "Ouvrir la caméra"}
      </button>

      <form
        className="mt-6 flex gap-2"
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <label className="sr-only" htmlFor="ticket-reference">
          Référence du billet
        </label>
        <input
          autoComplete="off"
          className="focus-ring min-h-12 min-w-0 flex-1 border border-border bg-surface px-4 text-base text-foreground"
          id="ticket-reference"
          maxLength={100}
          onChange={(event) => {
            setReference(event.target.value);
          }}
          placeholder="Référence du billet"
          value={reference}
        />
        <button
          aria-label="Rechercher le dossier"
          className="focus-ring grid size-12 place-items-center bg-brand text-white disabled:opacity-50"
          disabled={reference.trim().length < 2 || resolving}
          type="submit"
        >
          <Search className="size-5" />
        </button>
      </form>
      {(error ?? manualError) ? (
        <p className="mt-3 text-center text-sm text-danger" role="alert">
          {error ?? manualError}
        </p>
      ) : null}
    </div>
  );
}
