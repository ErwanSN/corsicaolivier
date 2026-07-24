'use client';

type GlobalErrorProps = Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>;

export default function GlobalError({ reset }: GlobalErrorProps) {
  return (
    <html lang="fr">
      <body className="min-h-svh bg-white text-neutral-950 antialiased">
        <main className="grid min-h-svh place-items-center px-6">
          <div className="text-center">
            <p className="text-sm font-medium text-neutral-500">Erreur</p>
            <h1 className="mt-2 text-2xl font-semibold">
              Une erreur est survenue
            </h1>
            <button
              className="mt-6 rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white"
              onClick={reset}
              type="button"
            >
              Réessayer
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
