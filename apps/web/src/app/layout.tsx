import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Corsica Linea',
    template: '%s — Corsica Linea',
  },
  description: 'Plateforme sécurisée des outils opérationnels Corsica Linea',
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="fr">
      <body className="min-h-svh bg-white text-zinc-950 antialiased">
        {children}
      </body>
    </html>
  );
}
