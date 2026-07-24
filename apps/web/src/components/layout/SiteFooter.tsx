import { ArrowRight, Camera, Mail, MessageCircle, Play } from "lucide-react";

import { Logo } from "./Logo";

const infoLinks = [
  [
    "Responsabilité des transporteurs",
    "/content/download/1152/file/Responsabilite-des-transporteurs.pdf"
  ],
  ["Droits des passagers", "/content/download/1153/file/Droits-des-passagers.pdf"],
  ["Assurance annulation Corse / Sardaigne", "/preparer-votre-voyage/assurances"],
  ["Assurance annulation Maghreb", "/preparer-votre-voyage/assurances"],
  ["Infos lignes et horaires", "/reserver/infos-lignes-et-horaires"],
  ["Gestion des cookies", "/plus/cookies"]
] as const;

const contactLinks = [
  ["Nos agences", "/la-compagnie/nous-contacter/nos-agences"],
  ["Nous envoyer un message", "/la-compagnie/nous-contacter/contactez-nous"],
  ["Tarifs", "/plus/tarifs"],
  ["Info ventes et modifications", "/plus/info-ventes-et-modifications"],
  ["Protection des données personnelles", "/plus/politique-de-protection-des-donnees-personnelles"],
  ["Index égalité professionnelle", "/la-compagnie/l-entreprise/egalite-professionnelle"]
] as const;

const socialLinks = [
  ["Facebook", "https://www.facebook.com/corsicalinea/", MessageCircle],
  ["Instagram", "https://www.instagram.com/corsicalinea/", Camera],
  ["YouTube", "https://www.youtube.com/@corsicalinea", Play]
] as const;

const paymentMethods = [
  { label: "Cartes Bancaires CB", src: "/api/payment-logo?brand=cb" },
  { label: "Visa", src: "/api/payment-logo?brand=visa" },
  { label: "Mastercard", src: "/api/payment-logo?brand=mastercard" },
  { label: "American Express", src: "/api/payment-logo?brand=amex" }
] as const;

function FooterLinkGroup({
  links,
  title
}: Readonly<{ links: readonly (readonly [string, string])[]; title: string }>) {
  return (
    <div>
      <h2 className="text-[12px] font-bold tracking-[0.1em] text-muted uppercase">{title}</h2>
      <ul className="mt-5 space-y-3">
        {links.map(([label, path]) => (
          <li key={label}>
            <a
              className="focus-ring text-[13px] leading-5 text-foreground/65 transition hover:text-brand"
              href={`https://www.corsicalinea.com${path}`}
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PaymentMethods() {
  return (
    <div className="mt-5 grid grid-cols-2 gap-2" role="list">
      {paymentMethods.map((method) => (
        <span
          aria-label={method.label}
          className="flex h-12 items-center justify-center rounded-lg border border-border bg-white px-3"
          key={method.label}
          role="listitem"
        >
          <img
            alt=""
            className="h-7 max-h-7 w-full max-w-[74px] object-contain"
            decoding="async"
            loading="lazy"
            src={method.src}
          />
        </span>
      ))}
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface pb-20 lg:pb-0">
      <FooterHighlights />

      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-[1.1fr_1fr_1fr_0.8fr] lg:px-8 lg:py-14">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-5 text-[13px] leading-6 text-foreground/60">
            Transport de passagers et de marchandises entre Marseille, la Corse, l’Algérie et la
            Tunisie.
          </p>
          <p className="mt-4 text-[12px] leading-5 text-muted">
            Siège social · 4 boulevard Roi Jérôme
            <br />
            20000 Ajaccio
          </p>
        </div>
        <FooterLinkGroup links={infoLinks} title="Informations" />
        <FooterLinkGroup links={contactLinks} title="Contacts & services" />
        <div>
          <h2 className="text-[12px] font-bold tracking-[0.1em] text-muted uppercase">
            Règlements acceptés
          </h2>
          <PaymentMethods />
          <a
            className="focus-ring mt-7 inline-flex items-center gap-2 text-[13px] font-semibold text-brand"
            href="https://www.corsicalinea.com/plus/faq"
          >
            La FAQ, c’est ici <ArrowRight className="size-4" />
          </a>
        </div>
      </div>

      <div className="border-t border-border bg-[#f6f6f6]">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-5 text-[11px] text-muted sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p>© {new Date().getFullYear()} CORSICA linea</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <a href="https://www.corsicalinea.com/plus/mentions-legales">Mentions légales</a>
            <a href="https://www.corsicalinea.com/plus/cgv">CGV</a>
            <a href="https://www.corsicalinea.com/plus/cgt">CGT</a>
            <a href="https://www.corsicalinea.com/plus/cgo2">CGO</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterHighlights() {
  return (
    <div className="border-b border-border bg-[#f3f1ed] text-foreground">
      <div className="mx-auto grid w-full max-w-7xl divide-y divide-border px-4 md:grid-cols-3 md:divide-x md:divide-y-0 lg:px-8">
        <a
          className="focus-ring flex items-center justify-between gap-4 py-7 md:px-6"
          href="https://www.corsicalinea.com/le-blog"
        >
          <span>
            <span className="block text-[12px] text-muted">Toute l’actualité sur notre</span>
            <strong className="mt-1 block text-[21px]">Blog</strong>
          </span>
          <ArrowRight className="size-5" />
        </a>
        <div className="py-7 md:px-6">
          <span className="block text-[12px] text-muted">Restons connectés</span>
          <div className="mt-3 flex gap-2">
            {socialLinks.map(([label, href, Icon]) => (
              <a
                aria-label={label}
                className="focus-ring grid size-9 place-items-center rounded-full border border-border bg-surface text-muted hover:text-foreground"
                href={href}
                key={label}
              >
                <Icon className="size-4" />
              </a>
            ))}
          </div>
        </div>
        <a
          className="focus-ring flex items-center justify-between gap-4 py-7 md:px-6"
          href="https://cloud.mail.corsicalinea.com/inscription-newsletter"
        >
          <span>
            <span className="block text-[12px] text-muted">
              Une promotion est si vite arrivée !
            </span>
            <strong className="mt-1 block text-[17px]">S’inscrire à la newsletter</strong>
          </span>
          <Mail className="size-5" />
        </a>
      </div>
    </div>
  );
}
