import { ArrowUpRight, Map } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "../../components/ds/Button";

export function TripSearchBar() {
  return (
    <div className="flex w-full max-w-xl flex-col gap-3 bg-surface p-3 shadow-[0_20px_60px_rgba(0,0,0,0.28)] sm:flex-row">
      <a
        className={buttonVariants({ className: "flex-1", size: "lg", variant: "brand" })}
        href="https://www.corsicalinea.com"
      >
        Réserver sur le site officiel
        <ArrowUpRight aria-hidden="true" className="size-4" />
      </a>
      <Link
        className={buttonVariants({ className: "flex-1", size: "lg", variant: "outline" })}
        href="/port"
      >
        <Map aria-hidden="true" className="size-4" />
        Consulter la carte du port
      </Link>
    </div>
  );
}
