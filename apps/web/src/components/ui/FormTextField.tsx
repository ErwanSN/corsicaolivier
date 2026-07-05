import { type ChangeEventHandler, useId } from "react";

import styles from "./FormTextField.module.css";

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
      <label className="visually-hidden" htmlFor={inputId}>
        {label}
      </label>
      <input
        autoComplete={autoComplete}
        className={styles.input}
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
