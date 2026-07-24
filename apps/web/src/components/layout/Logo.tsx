import Link from "next/link";

import { webBrandImages } from "../../assets/brand-images";

export function Logo() {
  return (
    <Link className="flex shrink-0 items-center gap-2.5 rounded-sm focus-ring" href="/">
      <span className="text-[19px] leading-none font-extrabold tracking-tight sm:text-[22px]">
        <span className="text-brand">CORSICA</span>{" "}
        <span className="font-semibold text-foreground/80">linea</span>
      </span>
      <span className="grid size-10 place-items-center rounded-full bg-brand sm:size-11">
        <img
          alt="Corsica Linea"
          className="size-6 object-contain"
          src={webBrandImages.logoSymbolWhite.source.src}
        />
      </span>
    </Link>
  );
}
