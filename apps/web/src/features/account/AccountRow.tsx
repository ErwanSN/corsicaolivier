import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { type ReactNode } from "react";

import { cn } from "../../lib/cn";

export type AccountRowProps = Readonly<{
  href?: string;
  onClick?: () => void;
  subtitle?: string;
  title: string;
  tone?: "danger" | "default";
  trailing?: ReactNode;
}>;

export function AccountRow({
  href,
  onClick,
  subtitle,
  title,
  tone = "default",
  trailing
}: AccountRowProps) {
  const className = cn(
    "focus-ring flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition",
    tone === "danger"
      ? "border-brand/20 bg-brand/5 hover:bg-brand/10"
      : "border-border bg-surface hover:border-foreground/25"
  );

  const content = (
    <>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-[15px] font-semibold",
            tone === "danger" ? "text-brand" : "text-foreground"
          )}
        >
          {title}
        </span>
        {subtitle ? (
          <span className="mt-0.5 block truncate text-[12px] text-muted">{subtitle}</span>
        ) : null}
      </span>
      <span className={tone === "danger" ? "text-brand" : "text-muted"}>
        {trailing ?? <ChevronRight className="size-5" />}
      </span>
    </>
  );

  if (href) {
    if (href.startsWith("/")) {
      return (
        <Link className={className} href={href}>
          {content}
        </Link>
      );
    }

    return (
      <a className={className} href={href}>
        {content}
      </a>
    );
  }

  return (
    <button className={className} onClick={onClick} type="button">
      {content}
    </button>
  );
}
