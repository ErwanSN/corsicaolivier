import { type ReactNode } from "react";

type ButtonVariant = "brand" | "outline" | "primary" | "secondary";
type ButtonSize = "large" | "regular";

export type ButtonProps = Readonly<{
  disabled?: boolean;
  label: string;
  leftAccessory?: ReactNode;
  onClick?: () => void;
  size?: ButtonSize;
  type?: "button" | "submit";
  variant?: ButtonVariant;
}>;

const buttonClassName = [
  "group inline-flex h-[35px] min-w-[min(160px,100%)] items-center justify-center gap-3",
  "overflow-hidden rounded-full border border-transparent px-5",
  "[transition:opacity_160ms_ease,transform_160ms_ease] focus-ring",
  "active:translate-y-px active:opacity-[0.82]",
  "disabled:cursor-not-allowed disabled:opacity-[0.46]",
  "data-[variant=primary]:bg-surface-inverse data-[variant=primary]:text-background",
  "data-[variant=brand]:bg-brand data-[variant=brand]:text-background",
  "data-[variant=secondary]:bg-surface data-[variant=secondary]:text-foreground",
  "data-[variant=outline]:border-border data-[variant=outline]:bg-surface data-[variant=outline]:text-foreground",
  "data-[size=large]:h-12 data-[size=large]:min-w-[min(184px,100%)] data-[size=large]:px-6"
].join(" ");

export function Button({
  disabled = false,
  label,
  leftAccessory,
  onClick,
  size = "regular",
  type = "button",
  variant = "primary"
}: ButtonProps) {
  return (
    <button
      className={buttonClassName}
      data-size={size}
      data-variant={variant}
      disabled={disabled}
      onClick={onClick}
      type={type}
    >
      {leftAccessory ? (
        <span className="inline-flex h-[18px] w-[18px] items-center justify-center">
          {leftAccessory}
        </span>
      ) : null}
      <span className="text-[14px] font-medium leading-[18px] group-data-[size=large]:text-[15px] group-data-[size=large]:leading-5">
        {label}
      </span>
    </button>
  );
}
