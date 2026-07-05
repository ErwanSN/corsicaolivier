import { type Metadata } from "next";
import { Inter } from "next/font/google";

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
      <body>{children}</body>
    </html>
  );
}
