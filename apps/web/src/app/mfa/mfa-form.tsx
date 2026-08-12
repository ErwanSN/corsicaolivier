'use client';

import Image from 'next/image';
import { useActionState } from 'react';

import {
  enrollTotp,
  type MfaEnrollmentState,
  type MfaVerificationState,
  verifyTotp,
} from './actions';

const initialEnrollment: MfaEnrollmentState = {};
const initialVerification: MfaVerificationState = {};

function VerificationForm({ factorId }: Readonly<{ factorId: string }>) {
  const [state, action, pending] = useActionState(
    verifyTotp,
    initialVerification,
  );

  return (
    <form action={action} aria-busy={pending} className="mt-6 space-y-4">
      <input name="factorId" type="hidden" value={factorId} />
      <div className="space-y-2">
        <label className="field-label" htmlFor="totp-code">
          Code à 6 chiffres
        </label>
        <input
          aria-describedby={state.error ? 'mfa-error' : undefined}
          aria-invalid={Boolean(state.error)}
          autoComplete="one-time-code"
          className="field-input text-center font-mono tracking-[0.35em]"
          disabled={pending}
          id="totp-code"
          inputMode="numeric"
          maxLength={6}
          minLength={6}
          name="code"
          pattern="[0-9]{6}"
          required
        />
      </div>
      {state.error ? (
        <p
          className="border-l-2 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-900"
          id="mfa-error"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}
      <button
        className="primary-button w-full"
        disabled={pending}
        type="submit"
      >
        {pending ? 'Vérification…' : 'Vérifier'}
      </button>
    </form>
  );
}

export function MfaForm(props: Readonly<{ verifiedFactorId?: string }>) {
  const [state, action, pending] = useActionState(
    enrollTotp,
    initialEnrollment,
  );
  const factorId = props.verifiedFactorId ?? state.enrollment?.factorId;

  if (factorId) {
    return (
      <>
        {state.enrollment ? (
          <div className="mt-6 space-y-4 text-center">
            <p className="text-sm leading-6 text-zinc-600">
              Scannez ce QR code avec votre application d’authentification.
            </p>
            <Image
              alt="QR code d’enrôlement TOTP"
              className="mx-auto size-48"
              height={192}
              src={state.enrollment.qrCode}
              unoptimized
              width={192}
            />
            <details className="text-left text-xs text-zinc-500">
              <summary className="cursor-pointer">Saisie manuelle</summary>
              <code className="mt-2 block break-all rounded bg-zinc-100 p-3">
                {state.enrollment.secret}
              </code>
            </details>
          </div>
        ) : (
          <p className="mt-6 text-sm leading-6 text-zinc-600">
            Ouvrez votre application d’authentification pour obtenir le code.
          </p>
        )}
        <VerificationForm factorId={factorId} />
      </>
    );
  }

  return (
    <form action={action} aria-busy={pending} className="mt-6 space-y-4">
      <p className="text-sm leading-6 text-zinc-600">
        Configurez une application TOTP pour sécuriser votre accès.
      </p>
      {state.error ? (
        <p
          className="border-l-2 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-900"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}
      <button
        className="primary-button w-full"
        disabled={pending}
        type="submit"
      >
        {pending ? 'Préparation…' : 'Configurer maintenant'}
      </button>
    </form>
  );
}
