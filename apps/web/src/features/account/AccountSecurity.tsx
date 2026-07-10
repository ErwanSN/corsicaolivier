"use client";

import { authPasswordMinLength, type AuthUserDto } from "@corsica/contracts";
import { CheckCircle2, KeyRound } from "lucide-react";
import { useState, type SyntheticEvent } from "react";

import { Button } from "../../components/ds/Button";
import { apiClient } from "../../lib/api-client";
import { getApiClientErrorMessage } from "@corsica/api-client";
import { AccountRow } from "./AccountRow";

export function AccountSecurity({ session }: Readonly<{ session: { user: AuthUserDto } }>) {
  return session.user.role === "USER" ? <ClientPasswordChange /> : <StaffPasswordRequest />;
}

function ClientPasswordChange() {
  const [expanded, setExpanded] = useState(false);
  if (!expanded) {
    return (
      <AccountRow
        onClick={() => {
          setExpanded(true);
        }}
        subtitle="Modification immédiate après vérification"
        title="Modifier mon mot de passe"
        trailing={<KeyRound className="size-5" />}
      />
    );
  }
  return (
    <ClientPasswordForm
      onCancel={() => {
        setExpanded(false);
      }}
    />
  );
}

function ClientPasswordForm({ onCancel }: Readonly<{ onCancel: () => void }>) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const currentPassword = readFormValue(data, "currentPassword");
    const newPassword = readFormValue(data, "newPassword");
    const confirmation = readFormValue(data, "confirmation");
    if (newPassword !== confirmation) {
      setError("Les deux nouveaux mots de passe ne correspondent pas.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      await apiClient.changePassword(undefined, { currentPassword, newPassword });
      setSuccess(true);
    } catch (caught) {
      setError(getApiClientErrorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  if (success) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-success/30 bg-success/5 p-4 text-[14px] font-semibold">
        <CheckCircle2 className="size-5 text-success" /> Mot de passe modifié.
      </div>
    );
  }

  return (
    <form
      className="rounded-2xl border border-border bg-surface p-4"
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
    >
      <h3 className="text-[15px] font-semibold">Nouveau mot de passe</h3>
      <div className="mt-3 grid gap-3">
        <PasswordInput label="Mot de passe actuel" name="currentPassword" />
        <PasswordInput
          label="Nouveau mot de passe"
          minLength={authPasswordMinLength}
          name="newPassword"
        />
        <PasswordInput
          label="Confirmer le nouveau mot de passe"
          minLength={authPasswordMinLength}
          name="confirmation"
        />
      </div>
      {error ? (
        <p className="mt-3 text-[13px] text-brand" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex gap-2">
        <Button disabled={pending} size="sm" type="submit">
          {pending ? "Modification…" : "Enregistrer"}
        </Button>
        <Button disabled={pending} onClick={onCancel} size="sm" variant="ghost">
          Annuler
        </Button>
      </div>
    </form>
  );
}

function readFormValue(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === "string" ? value : "";
}

function PasswordInput({
  label,
  minLength = 1,
  name
}: Readonly<{ label: string; minLength?: number; name: string }>) {
  return (
    <label className="grid gap-1.5 text-[13px] font-medium">
      {label}
      <input
        autoComplete={name === "currentPassword" ? "current-password" : "new-password"}
        className="focus-ring h-11 rounded-xl border border-border bg-background px-3 text-[15px]"
        minLength={minLength}
        name={name}
        required
        type="password"
      />
    </label>
  );
}

function StaffPasswordRequest() {
  const [state, setState] = useState<"idle" | "pending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  async function requestChange(): Promise<void> {
    setState("pending");
    setError(null);
    try {
      await apiClient.requestPasswordChange();
      setState("sent");
    } catch (caught) {
      setError(getApiClientErrorMessage(caught));
      setState("idle");
    }
  }
  if (state === "sent") {
    return (
      <AccountRow
        subtitle="Demande transmise au service habilité"
        title="Modification en attente"
        trailing={<CheckCircle2 className="size-5 text-success" />}
      />
    );
  }
  return (
    <>
      <AccountRow
        onClick={() => void requestChange()}
        subtitle="Validation obligatoire pour les comptes professionnels"
        title={state === "pending" ? "Envoi de la demande…" : "Demander un nouveau mot de passe"}
        trailing={<KeyRound className="size-5" />}
      />
      {error ? (
        <p className="px-1 text-[13px] text-brand" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
