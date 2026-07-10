import { type Metadata } from "next";
import { Inter } from "next/font/google";

import { AuthSessionProvider } from "../features/auth/AuthSessionProvider";
import { RoleRedirect } from "../features/auth/RoleRedirect";
import "@corsica/ui/tokens.css";
import "./globals.css";

const inter = Inter({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-inter"
});

export const metadata: Metadata = {
  description: "Plateforme client Corsica Linea.",
  title: "Corsica Linea"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className={inter.variable} lang="fr">
      <body>
        <a
          className="focus-ring fixed left-4 top-4 z-[100] -translate-y-24 rounded-full bg-surface-inverse px-4 py-3 font-semibold text-background transition focus:translate-y-0"
          href="#main-content"
        >
          Aller au contenu principal
        </a>
        <AuthSessionProvider>
          <RoleRedirect />
          {children}
        </AuthSessionProvider>
      </body>
    </html>
  );
}
