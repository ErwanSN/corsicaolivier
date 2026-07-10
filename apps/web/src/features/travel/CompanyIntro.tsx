import { ExternalLink } from "lucide-react";

import { companyContent } from "./home-content";

export function CompanyIntro() {
  return (
    <section
      aria-labelledby="company-heading"
      className="scroll-mt-20 bg-surface pt-16 pb-28 sm:py-20"
    >
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-16 lg:px-8">
        <div>
          <p className="mb-3 text-[13px] font-bold text-brand uppercase">La compagnie</p>
          <h2
            className="max-w-xl text-[30px] leading-9 font-semibold text-foreground md:text-[38px] md:leading-[44px]"
            id="company-heading"
          >
            {companyContent.title}
          </h2>
        </div>

        <div className="flex flex-col justify-center">
          {companyContent.paragraphs.map((paragraph) => (
            <p className="mb-5 text-[16px] leading-7 text-foreground/70" key={paragraph}>
              {paragraph}
            </p>
          ))}
          <a
            className="focus-ring mt-2 inline-flex w-fit items-center gap-2 text-[14px] font-semibold text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
            href={companyContent.href}
            rel="noreferrer"
            target="_blank"
          >
            En savoir plus sur la compagnie
            <ExternalLink aria-hidden="true" className="size-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
