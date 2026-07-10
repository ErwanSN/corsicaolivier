import { type ChangeEventHandler, useId } from "react";

type FormTextFieldPosition = "first" | "last" | "single";

export type FormTextFieldProps = Readonly<{
  autoComplete?: string;
  disabled?: boolean;
  fieldPosition?: FormTextFieldPosition;
  id?: string;
  inputMode?: "email" | "text";
  label: string;
  minLength?: number;
  name: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  placeholder: string;
  required?: boolean;
  type?: "email" | "password" | "text";
  value?: string;
}>;

const inputClassName = [
  "h-14 min-w-0 rounded-xl border border-border bg-surface px-3.5",
  "text-[16px] leading-[22px] text-foreground placeholder:text-muted",
  "focus:relative focus:z-10 focus:border-foreground focus:outline-none",
  "disabled:cursor-not-allowed disabled:opacity-[0.62]",
  "data-[field-position=first]:rounded-b-none",
  "data-[field-position=last]:-mt-px data-[field-position=last]:rounded-t-none"
].join(" ");

export function FormTextField({
  autoComplete,
  disabled = false,
  fieldPosition = "single",
  id,
  inputMode = "text",
  label,
  minLength,
  name,
  onChange,
  placeholder,
  required = false,
  type = "text",
  value
}: FormTextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <>
      <label className="sr-only" htmlFor={inputId}>
        {label}
      </label>
      <input
        autoComplete={autoComplete}
        className={inputClassName}
        data-field-position={fieldPosition}
        disabled={disabled}
        id={inputId}
        inputMode={inputMode}
        minLength={minLength}
        name={name}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        type={type}
        value={value}
      />
    </>
  );
}
