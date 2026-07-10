import {
  authCredentialsSchema,
  authPasswordMinLength,
  loginCredentialsSchema,
  type AuthCredentialsDto
} from "@corsica/contracts";

import { type AuthFormMode } from "./auth.types";

export type AuthFormValidation =
  | Readonly<{ credentials: AuthCredentialsDto; success: true }>
  | Readonly<{ message: string; success: false }>;

export function validateAuthForm(
  mode: AuthFormMode,
  email: string,
  password: string
): AuthFormValidation {
  const normalizedEmail = email.trim().toLowerCase();
  if (mode === "createAccount") {
    const parsed = authCredentialsSchema.safeParse({ email: normalizedEmail, password });
    if (!parsed.success) {
      return {
        message:
          password.length < authPasswordMinLength
            ? `Le mot de passe doit contenir au moins ${String(authPasswordMinLength)} caractères.`
            : "Saisissez une adresse email valide.",
        success: false
      };
    }
    return { credentials: parsed.data, success: true };
  }
  const parsed = loginCredentialsSchema.safeParse({ identifier: normalizedEmail, password });
  return parsed.success
    ? {
        credentials: { email: parsed.data.identifier, password: parsed.data.password },
        success: true
      }
    : { message: "Saisissez un identifiant et un mot de passe valides.", success: false };
}
