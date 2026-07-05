import { getApiClientErrorMessage } from "@corsica/api-client";
import { authPasswordMinLength } from "@corsica/contracts";
import { useState } from "react";

import { type AuthSubmitHandler } from "./auth.types";

export type AuthFormState = Readonly<{
  email: string;
  errorMessage: string | null;
  isSubmitting: boolean;
  password: string;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  submit: () => Promise<void>;
}>;

export function useAuthForm(onSubmit: AuthSubmitHandler): AuthFormState {
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState("");

  async function submit(): Promise<void> {
    if (password.length < authPasswordMinLength) {
      setErrorMessage(
        `Le mot de passe doit contenir au moins ${String(authPasswordMinLength)} caractères.`
      );
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await onSubmit({
        email,
        password
      });
    } catch (error) {
      setErrorMessage(getApiClientErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    email,
    errorMessage,
    isSubmitting,
    password,
    setEmail,
    setPassword,
    submit
  };
}
