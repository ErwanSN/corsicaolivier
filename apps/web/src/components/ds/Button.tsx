import { cva, type VariantProps } from "class-variance-authority";
import { type ButtonHTMLAttributes, forwardRef } from "react";

import { cn } from "../../lib/cn";

export const buttonVariants = cva(
  "focus-ring inline-flex shrink-0 items-center justify-center gap-2 font-semibold transition disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-surface-inverse text-background hover:opacity-90",
        brand: "bg-brand text-white hover:opacity-90",
        outline: "border border-border bg-surface text-foreground hover:border-foreground/30",
        ghost: "text-foreground hover:bg-foreground/5",
        link: "text-foreground underline-offset-4 hover:underline"
      },
      size: {
        sm: "h-9 rounded-full px-4 text-[13px]",
        md: "h-11 rounded-full px-5 text-[14px]",
        lg: "h-12 rounded-full px-6 text-[15px]",
        icon: "size-10 rounded-full",
        iconLg: "size-12 rounded-full"
      }
    },
    defaultVariants: {
      size: "md",
      variant: "primary"
    }
  }
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, size, type = "button", variant, ...props },
  ref
) {
  return (
    <button
      className={cn(buttonVariants({ className, size, variant }))}
      ref={ref}
      type={type}
      {...props}
    />
  );
});
