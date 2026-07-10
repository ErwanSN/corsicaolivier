import { getApiClientErrorMessage } from "@corsica/api-client";
import { useState } from "react";

import { validateAuthForm } from "./auth-form-validation";
import { type AuthFormMode, type AuthSubmitHandler } from "./auth.types";

export type AuthFormState = Readonly<{
  email: string;
  errorMessage: string | null;
  isSubmitting: boolean;
  password: string;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  submit: () => Promise<void>;
}>;

export function useAuthForm(mode: AuthFormMode, onSubmit: AuthSubmitHandler): AuthFormState {
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState("");

  async function submit(): Promise<void> {
    const validation = validateAuthForm(mode, email, password);
    if (!validation.success) {
      setErrorMessage(validation.message);
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await onSubmit(validation.credentials);
    } catch (error) {
      setErrorMessage(getApiClientErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return { email, errorMessage, isSubmitting, password, setEmail, setPassword, submit };
}
