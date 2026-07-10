"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { apiClient } from "../../lib/api-client";

interface BarcodeDetectorLike {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
}

type BarcodeDetectorConstructor = new (options: { formats: string[] }) => BarcodeDetectorLike;

export function useQrScanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });
    streamRef.current = null;
    setScanning(false);
  }, []);

  const resolveReference = useCallback(
    async (rawValue: string): Promise<void> => {
      const reference = extractReference(rawValue);
      const dossiers = await apiClient.searchDossiers(undefined, {
        field: "dossier",
        query: reference
      });
      const dossier = dossiers.find((item) => item.reference === reference);
      if (!dossier) throw new Error("Dossier absent");
      stop();
      router.push(`/salarie/dossier/${dossier.id}`);
    },
    [router, stop]
  );

  const start = useCallback(async () => {
    setError(null);
    const Detector = (globalThis as { BarcodeDetector?: BarcodeDetectorConstructor })
      .BarcodeDetector;
    if (!Detector) {
      setError("Le scan caméra n’est pas pris en charge par ce navigateur. Utilisez la référence.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } }
      });
      streamRef.current = stream;
      if (!videoRef.current) {
        stop();
        return;
      }
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setScanning(true);
      const detector = new Detector({ formats: ["qr_code"] });
      scanFrame({ detector, frameRef, resolveReference, setError, video: videoRef.current });
    } catch {
      stop();
      setError("Impossible d’accéder à la caméra. Vérifiez son autorisation.");
    }
  }, [resolveReference, stop]);

  useEffect(() => stop, [stop]);
  return { error, resolveReference, scanning, start, stop, videoRef };
}

function scanFrame({
  detector,
  frameRef,
  resolveReference,
  setError,
  video
}: Readonly<{
  detector: BarcodeDetectorLike;
  frameRef: { current: number | null };
  resolveReference: (value: string) => Promise<void>;
  setError: (message: string) => void;
  video: HTMLVideoElement;
}>): void {
  const tick = async (): Promise<void> => {
    try {
      const result = (await detector.detect(video))[0];
      if (result) {
        await resolveReference(result.rawValue);
        return;
      }
    } catch {
      setError("QR code illisible ou dossier introuvable.");
    }
    frameRef.current = requestAnimationFrame(() => {
      void tick();
    });
  };
  frameRef.current = requestAnimationFrame(() => {
    void tick();
  });
}

function extractReference(rawValue: string): string {
  const trimmed = rawValue.trim();
  try {
    const parsed = JSON.parse(trimmed) as { reference?: unknown };
    if (typeof parsed.reference === "string") return parsed.reference.trim();
  } catch {
    // A plain ticket reference is the normal format.
  }
  return trimmed.split("/").filter(Boolean).at(-1)?.slice(0, 100) ?? trimmed.slice(0, 100);
}
