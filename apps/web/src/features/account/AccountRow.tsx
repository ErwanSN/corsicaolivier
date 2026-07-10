import { ChevronRight } from "lucide-react";
import { type Route } from "next";
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
  const interactive = Boolean(href ?? onClick);
  const className = accountRowClassName(interactive, tone);
  const content = (
    <AccountRowContent
      interactive={interactive}
      subtitle={subtitle}
      title={title}
      tone={tone}
      trailing={trailing}
    />
  );

  if (href) return <AccountRowLink className={className} content={content} href={href} />;
  if (onClick)
    return (
      <button className={className} onClick={onClick} type="button">
        {content}
      </button>
    );
  return <div className={className}>{content}</div>;
}

function AccountRowContent({
  interactive,
  subtitle,
  title,
  tone,
  trailing
}: Readonly<{
  interactive: boolean;
  subtitle: string | undefined;
  title: string;
  tone: "danger" | "default";
  trailing: ReactNode;
}>) {
  return (
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
      {interactive ? (
        <span className={tone === "danger" ? "text-brand" : "text-muted"}>
          {trailing ?? <ChevronRight className="size-5" />}
        </span>
      ) : null}
    </>
  );
}

function AccountRowLink({
  className,
  content,
  href
}: Readonly<{ className: string; content: ReactNode; href: string }>) {
  if (isInternalRoute(href))
    return (
      <Link className={className} href={href}>
        {content}
      </Link>
    );
  return (
    <a className={className} href={href}>
      {content}
    </a>
  );
}

function accountRowClassName(interactive: boolean, tone: "danger" | "default"): string {
  return cn(
    "flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left",
    interactive ? "focus-ring transition" : "cursor-default",
    tone === "danger"
      ? "border-brand/20 bg-brand/5 hover:bg-brand/10"
      : cn("border-border bg-surface", interactive && "hover:border-foreground/25")
  );
}

function isInternalRoute(href: string): href is Route {
  return href.startsWith("/");
}
