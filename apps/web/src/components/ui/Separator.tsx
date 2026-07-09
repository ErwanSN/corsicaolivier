export type SeparatorProps = Readonly<{
  label: string;
}>;

export function Separator({ label }: SeparatorProps) {
  return (
    <div className="flex h-[18px] items-center justify-center gap-3">
      <span className="h-px flex-1 bg-border" />
      <span className="text-[11px] leading-[14px] text-muted">{label}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
