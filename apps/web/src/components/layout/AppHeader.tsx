"use client";

import { ChevronDown, HelpCircle, Menu, Phone, User, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { cn } from "../../lib/cn";
import { LanguageSelect } from "./LanguageSelect";
import { Logo } from "./Logo";
import { navItems } from "./nav-items";

const socialLinks = [
  ["Instagram", "https://www.instagram.com/corsicalinea/", "instagram"],
  ["Twitter", "https://twitter.com/corsicalinea", "twitter"],
  ["YouTube", "https://www.youtube.com/channel/UC8i1p9faTRcUi1uDhWXotvg", "youtube"]
] as const;

const socialLogoPaths = {
  instagram:
    "M7.03.08C5.75.15 4.88.35 4.12.65 3.33.95 2.66 1.37 2 2.04S.92 3.37.62 4.16C.32 4.92.12 5.8.06 7.08 0 8.35 0 8.77 0 12s0 3.65.08 4.95c.06 1.28.26 2.15.56 2.91.31.79.72 1.46 1.39 2.12.67.67 1.34 1.08 2.13 1.38.76.3 1.64.5 2.91.56 1.28.06 1.69.07 4.95.06 3.26-.01 3.67-.02 4.95-.08 1.28-.06 2.15-.27 2.91-.57.79-.3 1.46-.72 2.12-1.39.67-.67 1.08-1.34 1.38-2.13.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.06-4.95 0-3.26-.02-3.67-.08-4.95-.06-1.28-.26-2.15-.56-2.91-.31-.79-.72-1.46-1.39-2.12C21.3 1.33 20.63.92 19.84.62c-.77-.3-1.64-.5-2.92-.56C15.65.01 15.24 0 11.98 0 8.72.01 8.31.02 7.03.08ZM12 5.84A6.16 6.16 0 1 0 12 18.16 6.16 6.16 0 0 0 12 5.84Zm0 10.16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm6.39-10.42a1.44 1.44 0 1 1-2.88 0 1.44 1.44 0 0 1 2.88 0Z",
  twitter:
    "M23.95 4.57a10 10 0 0 1-2.83.78 4.93 4.93 0 0 0 2.17-2.72 9.86 9.86 0 0 1-3.13 1.2A4.92 4.92 0 0 0 11.77 8.3 13.98 13.98 0 0 1 1.64 3.16a4.92 4.92 0 0 0 1.52 6.57A4.9 4.9 0 0 1 .93 9.1v.06a4.93 4.93 0 0 0 3.95 4.83 4.94 4.94 0 0 1-2.22.08 4.93 4.93 0 0 0 4.6 3.42A9.9 9.9 0 0 1 1.14 19.6 13.94 13.94 0 0 0 8.67 21.8c9.05 0 14-7.5 14-14l-.02-.64a10 10 0 0 0 2.46-2.55Z",
  youtube:
    "M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81ZM9.55 15.57V8.43L15.82 12l-6.27 3.57Z"
} as const;

function SocialLogo({ name }: Readonly<{ name: keyof typeof socialLogoPaths }>) {
  return (
    <svg aria-hidden="true" className="size-3.5 fill-current" viewBox="0 0 24 24">
      <path d={socialLogoPaths[name]} />
    </svg>
  );
}

// Header markup stays together so desktop and mobile navigation share one state and one item source.
// eslint-disable-next-line max-lines-per-function
export function AppHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-[60] bg-surface shadow-[0_3px_18px_rgb(0_0_0/0.09)]">
      <div className="hidden border-b border-border/70 lg:block">
        <div className="mx-auto flex h-8 max-w-[1440px] items-center justify-end gap-6 px-8 text-[11px] font-medium text-muted">
          <a
            className="flex items-center gap-1.5 transition hover:text-brand"
            href="tel:0825888088"
          >
            <Phone className="size-3.5" /> 0825 88 80 88
          </a>
          <Link className="flex items-center gap-1.5 transition hover:text-brand" href="/compte">
            <User className="size-3.5" /> Mon compte
          </Link>
          <span className="h-4 w-px bg-border" />
          <LanguageSelect />
          <span className="h-4 w-px bg-border" />
          <div aria-label="Réseaux sociaux CORSICA linea" className="flex items-center gap-1">
            {socialLinks.map(([label, href, logo]) => (
              <a
                aria-label={label}
                className="focus-ring grid size-6 place-items-center rounded-full text-muted transition hover:bg-foreground/5 hover:text-brand"
                href={href}
                key={label}
                rel="noreferrer"
                target="_blank"
              >
                <SocialLogo name={logo} />
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto flex h-16 max-w-[1440px] items-stretch px-4 sm:px-6 lg:h-[68px] lg:px-8">
        <div className="flex items-center lg:pr-9">
          <Logo />
        </div>

        <nav aria-label="Navigation principale" className="hidden flex-1 items-stretch lg:flex">
          {navItems.map((item, index) => {
            const active =
              pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <div className="group relative flex items-stretch" key={item.label}>
                <Link
                  className={cn(
                    "relative flex items-center gap-1 px-2.5 text-center text-[12px] font-semibold leading-tight xl:px-4 xl:text-[13px]",
                    active ? "text-brand" : "text-foreground hover:text-brand"
                  )}
                  href={item.href}
                >
                  {item.label}
                  <ChevronDown className="size-3 transition group-hover:rotate-180" />
                  <span
                    className={cn(
                      "absolute inset-x-3 bottom-0 h-[3px] bg-brand transition-transform",
                      active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                    )}
                  />
                </Link>
                <div
                  className={cn(
                    "invisible absolute top-full z-50 max-h-[calc(100vh-110px)] w-max max-w-[calc(100vw-32px)] translate-y-2 overflow-y-auto border-t-2 border-brand bg-white p-5 text-foreground opacity-0 shadow-[0_14px_35px_rgb(0_0_0/0.16)] transition duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100",
                    index >= navItems.length - 2 ? "right-0" : "left-0"
                  )}
                >
                  <div
                    className={cn(
                      "grid gap-6",
                      item.groups.length >= 3
                        ? "grid-cols-[repeat(3,minmax(140px,max-content))]"
                        : "grid-cols-[repeat(2,minmax(140px,max-content))]"
                    )}
                  >
                    {item.groups.map((group) => (
                      <div key={group.title}>
                        <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-brand">
                          {group.title}
                        </p>
                        <ul className="space-y-2">
                          {group.links.map((link) => (
                            <li key={link.label}>
                              <Link
                                className="text-[12px] font-medium hover:text-brand"
                                href={link.href}
                              >
                                {link.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        <div className="ml-auto flex items-stretch">
          <Link
            className="my-2 hidden items-center bg-brand px-6 text-[13px] font-bold uppercase tracking-[0.08em] text-white transition hover:bg-[#bb171d] sm:flex lg:my-0 lg:px-7"
            href="/#reservation"
          >
            Réserver
          </Link>
          <button
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            className="ml-2 grid w-12 place-items-center text-foreground lg:hidden"
            onClick={() => {
              setMenuOpen((open) => !open);
            }}
            type="button"
          >
            {menuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="max-h-[calc(100svh-4rem)] overflow-y-auto overscroll-contain border-t border-border bg-surface px-5 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:hidden">
          <nav aria-label="Menu mobile" className="mx-auto max-w-lg">
            {navItems.map((item) => (
              <details className="group border-b border-border" key={item.label}>
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-[14px] font-semibold">
                  {item.label}
                  <ChevronDown className="size-4 text-muted transition group-open:rotate-180" />
                </summary>
                <div className="grid gap-4 pb-5 pl-3 sm:grid-cols-2">
                  {item.groups.map((group) => (
                    <div key={group.title}>
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-brand">
                        {group.title}
                      </p>
                      {group.links.map((link) => (
                        <Link
                          className="block py-1.5 text-[13px] text-muted"
                          href={link.href}
                          key={link.label}
                          onClick={() => {
                            setMenuOpen(false);
                          }}
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              </details>
            ))}
            <div className="grid grid-cols-2 gap-3 pt-5">
              <Link
                className="flex h-12 items-center justify-center gap-2 border border-border text-sm font-semibold"
                href="/compte"
              >
                <User className="size-4" /> Mon compte
              </Link>
              <Link
                className="flex h-12 items-center justify-center gap-2 border border-border text-sm font-semibold"
                href="/#aide"
              >
                <HelpCircle className="size-4" /> Besoin d’aide ?
              </Link>
            </div>
            <Link
              className="mt-3 flex h-12 items-center justify-center bg-brand text-sm font-bold uppercase tracking-wider text-white sm:hidden"
              href="/#reservation"
            >
              Réserver
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
