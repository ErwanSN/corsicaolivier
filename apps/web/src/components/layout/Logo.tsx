import Link from "next/link";

import { webBrandImages } from "../../assets/brand-images";

export function Logo() {
  return (
    <Link className="flex shrink-0 items-center gap-2 rounded-lg focus-ring" href="/">
      <span className="text-[20px] leading-none font-extrabold tracking-tight">
        <span className="text-brand">CORSICA</span>{" "}
        <span className="font-semibold text-foreground/80">linea</span>
      </span>
      <span className="grid size-9 place-items-center rounded-full bg-brand">
        <img
          alt="Corsica Linea"
          className="size-6 object-contain"
          src={webBrandImages.logoSymbolWhite.source.src}
        />
      </span>
    </Link>
  );
}
