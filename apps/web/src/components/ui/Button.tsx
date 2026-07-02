import { type ReactNode } from "react";

import styles from "./Button.module.css";

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
      className={styles.button}
      data-size={size}
      data-variant={variant}
      disabled={disabled}
      onClick={onClick}
      type={type}
    >
      {leftAccessory ? <span className={styles.accessory}>{leftAccessory}</span> : null}
      <span className={styles.label}>{label}</span>
    </button>
  );
}
