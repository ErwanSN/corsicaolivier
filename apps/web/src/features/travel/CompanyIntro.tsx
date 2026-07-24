import { ArrowRight } from "lucide-react";

import { companyContent } from "./home-content";

export function CompanyIntro() {
  return (
    <section
      aria-labelledby="company-heading"
      className="scroll-mt-20 bg-surface py-12 sm:py-14 md:py-16"
      id="compagnie"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-7 px-4 md:flex-row md:items-center md:justify-between lg:px-8">
        <div className="max-w-3xl">
          <p className="mb-3 text-[12px] font-bold tracking-[0.12em] text-brand uppercase">
            La compagnie
          </p>
          <h2
            className="text-[28px] leading-9 font-semibold text-foreground md:text-[34px]"
            id="company-heading"
          >
            Relier les territoires méditerranéens
          </h2>
          <p className="mt-3 max-w-2xl text-[15px] leading-6 text-foreground/65">
            CORSICA linea transporte chaque jour passagers et marchandises entre Marseille, la Corse
            et le Maghreb.
          </p>
        </div>
        <a
          className="focus-ring inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-full border border-border px-5 py-3 text-center text-[14px] font-semibold text-foreground transition hover:border-foreground/30 hover:bg-foreground/[0.04] sm:w-auto"
          href={companyContent.href}
          rel="noreferrer"
          target="_blank"
        >
          Découvrir la compagnie
          <ArrowRight aria-hidden="true" className="size-4" />
        </a>
      </div>
    </section>
  );
}
