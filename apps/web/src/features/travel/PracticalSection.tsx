import { ArrowUpRight } from "lucide-react";
import Image from "next/image";

import { practicalLinks } from "./home-content";

export function PracticalSection() {
  return (
    <section
      aria-labelledby="practical-heading"
      className="scroll-mt-20 bg-[#f6f6f6] py-16 md:py-20"
    >
      <div className="mx-auto w-full max-w-7xl px-4 lg:px-8">
        <h2
          className="text-[30px] leading-9 font-semibold text-foreground md:text-[38px] md:leading-[44px]"
          id="practical-heading"
        >
          Pratique
        </h2>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {practicalLinks.map((item) => (
            <a
              className="focus-ring group overflow-hidden rounded-lg border border-border bg-surface transition hover:border-foreground/25"
              href={item.href}
              key={item.href}
              rel="noreferrer"
              target="_blank"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-border">
                <Image
                  alt=""
                  className="object-cover transition duration-300 ease-out group-hover:scale-[1.025]"
                  fill
                  sizes="(min-width: 1024px) 22vw, 46vw"
                  src={item.image}
                />
              </div>
              <div className="flex min-h-[4.5rem] items-start gap-2 p-3.5 sm:p-4">
                <span className="text-[14px] leading-5 font-semibold text-foreground sm:text-[15px]">
                  {item.label}
                </span>
                <ArrowUpRight
                  aria-hidden="true"
                  className="mt-0.5 ml-auto size-4 shrink-0 text-muted transition group-hover:text-foreground"
                />
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
