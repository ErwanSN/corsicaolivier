import { getApiClientErrorMessage } from "@corsica/api-client";
import { type SyntheticEvent, useMemo, useState } from "react";

import { Button } from "../../../components/ui/Button";
import { FormTextField } from "../../../components/ui/FormTextField";
import { GoogleMark } from "../../../components/ui/GoogleMark";
import { Separator } from "../../../components/ui/Separator";
import { type AuthFormMode, type AuthSubmitHandler } from "../auth.types";
import styles from "./AuthFormPanel.module.css";

export type AuthFormPanelProps = Readonly<{
  mode: AuthFormMode;
  onSubmit: AuthSubmitHandler;
}>;

const copyByMode = {
  createAccount: {
    loadingLabel: "Création...",
    passwordAutocomplete: "new-password",
    submitLabel: "Créer un compte"
  },
  signIn: {
    loadingLabel: "Connexion...",
    passwordAutocomplete: "current-password",
    submitLabel: "Se connecter"
  }
} as const satisfies Record<
  AuthFormMode,
  Readonly<{
    loadingLabel: string;
    passwordAutocomplete: string;
    submitLabel: string;
  }>
>;

export function AuthFormPanel({ mode, onSubmit }: AuthFormPanelProps) {
  const copy = copyByMode[mode];
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState("");
  const titleId = useMemo(() => `auth-form-title-${mode}`, [mode]);

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>): void {
    event.preventDefault();
    void submitCredentials();
  }

  async function submitCredentials(): Promise<void> {
    if (password.length < 8) {
      setErrorMessage("Le mot de passe doit contenir au moins 8 caractères.");
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

  return (
    <section aria-labelledby={titleId} className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title} id={titleId}>
          Bienvenue sur Corsica Linea
        </h2>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.fieldGroup}>
          <FormTextField
            autoComplete="email"
            disabled={isSubmitting}
            fieldPosition="first"
            inputMode="email"
            name="email"
            onChange={(event) => {
              setEmail(event.target.value);
            }}
            placeholder="Email"
            required
            type="email"
            value={email}
          />
          <FormTextField
            autoComplete={copy.passwordAutocomplete}
            disabled={isSubmitting}
            fieldPosition="last"
            minLength={8}
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
          <p className={styles.error} role="alert">
            {errorMessage}
          </p>
        ) : null}

        <Button
          disabled={isSubmitting}
          label={isSubmitting ? copy.loadingLabel : copy.submitLabel}
          size="large"
          type="submit"
          variant="brand"
        />
      </form>

      <Separator label="ou" />

      <Button
        disabled
        label="Continuer avec Google"
        leftAccessory={<GoogleMark />}
        variant="outline"
      />
    </section>
  );
}
