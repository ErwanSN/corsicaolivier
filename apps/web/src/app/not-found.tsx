import Link from 'next/link';

export default function NotFoundPage() {
  return (
    <main className="grid min-h-svh place-items-center bg-white px-6 text-neutral-950">
      <div className="text-center">
        <p className="text-sm font-medium text-neutral-500">404</p>
        <h1 className="mt-2 text-2xl font-semibold">Page introuvable</h1>
        <Link
          className="mt-6 inline-flex rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white"
          href="/"
        >
          Retour à l’accueil
        </Link>
      </div>
    </main>
  );
}
