import { getApiClientErrorMessage } from "@corsica/api-client";
import { authPasswordMinLength } from "@corsica/contracts";
import { type SyntheticEvent, useId, useState } from "react";

import { Button } from "../../../components/ds/Button";
import { FormTextField } from "../../../components/ui/FormTextField";
import { GoogleMark } from "../../../components/ui/GoogleMark";
import { Separator } from "../../../components/ui/Separator";
import { type AuthFormMode, type AuthSubmitHandler } from "../auth.types";

export type AuthFormPanelProps = Readonly<{
  mode: AuthFormMode;
  onSubmit: AuthSubmitHandler;
}>;

const copyByMode = {
  createAccount: {
    enforcePasswordPolicy: true,
    identifierAutocomplete: "email",
    identifierInputMode: "email",
    identifierLabel: "Email",
    identifierName: "email",
    identifierPlaceholder: "Email",
    identifierType: "email",
    loadingLabel: "Création...",
    passwordAutocomplete: "new-password",
    submitLabel: "Créer un compte"
  },
  signIn: {
    enforcePasswordPolicy: false,
    identifierAutocomplete: "username",
    identifierInputMode: "text",
    identifierLabel: "Email ou nom d'utilisateur",
    identifierName: "identifier",
    identifierPlaceholder: "Email ou nom d'utilisateur",
    identifierType: "text",
    loadingLabel: "Connexion...",
    passwordAutocomplete: "current-password",
    submitLabel: "Se connecter"
  }
} as const satisfies Record<
  AuthFormMode,
  Readonly<{
    enforcePasswordPolicy: boolean;
    identifierAutocomplete: string;
    identifierInputMode: "email" | "text";
    identifierLabel: string;
    identifierName: string;
    identifierPlaceholder: string;
    identifierType: "email" | "text";
    loadingLabel: string;
    passwordAutocomplete: string;
    submitLabel: string;
  }>
>;

export function AuthFormPanel({ mode, onSubmit }: AuthFormPanelProps) {
  const copy = copyByMode[mode];
  const [identifier, setIdentifier] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState("");
  const titleId = useId();

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>): void {
    event.preventDefault();
    void submitCredentials();
  }

  async function submitCredentials(): Promise<void> {
    if (copy.enforcePasswordPolicy && password.length < authPasswordMinLength) {
      setErrorMessage(
        `Le mot de passe doit contenir au moins ${String(authPasswordMinLength)} caractères.`
      );
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await onSubmit({
        identifier,
        password
      });
    } catch (error) {
      setErrorMessage(getApiClientErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section aria-labelledby={titleId} className="grid min-w-0 gap-6 bg-surface">
      <h2 className="text-[22px] font-semibold leading-7 text-foreground" id={titleId}>
        Bienvenue sur Corsica Linea
      </h2>

      <form className="grid min-w-0 gap-4" onSubmit={handleSubmit}>
        <div className="grid min-w-0">
          <FormTextField
            autoComplete={copy.identifierAutocomplete}
            disabled={isSubmitting}
            fieldPosition="first"
            inputMode={copy.identifierInputMode}
            label={copy.identifierLabel}
            name={copy.identifierName}
            onChange={(event) => {
              setIdentifier(event.target.value);
            }}
            placeholder={copy.identifierPlaceholder}
            required
            type={copy.identifierType}
            value={identifier}
          />
          <FormTextField
            autoComplete={copy.passwordAutocomplete}
            disabled={isSubmitting}
            fieldPosition="last"
            label="Mot de passe"
            {...(copy.enforcePasswordPolicy ? { minLength: authPasswordMinLength } : {})}
            name="password"
            onChange={(event) => {
              setPassword(event.target.value);
            }}
            placeholder="Mot de passe"
            required
            type="password"
            value={password}
          />
        </div>

        {errorMessage ? (
          <p className="-mt-0.5 text-[13px] font-medium leading-[18px] text-brand" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <Button disabled={isSubmitting} size="lg" type="submit" variant="brand">
          {isSubmitting ? copy.loadingLabel : copy.submitLabel}
        </Button>
      </form>

      <Separator label="ou" />

      <Button disabled variant="outline">
        <GoogleMark />
        Continuer avec Google
      </Button>
    </section>
  );
}
