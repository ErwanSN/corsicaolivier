'use client';

import { useActionState } from 'react';

import { login, type LoginState } from './actions';

const initialState: LoginState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(login, initialState);
  const errorId = state.error ? 'login-error' : undefined;

  return (
    <form action={action} aria-busy={pending} className="mt-8 space-y-5">
      <div className="space-y-2">
        <label className="field-label" htmlFor="email">
          E-mail professionnel
        </label>
        <input
          aria-describedby={errorId}
          aria-invalid={Boolean(state.error)}
          autoComplete="email"
          autoCapitalize="none"
          className="field-input"
          disabled={pending}
          id="email"
          name="email"
          placeholder="prenom.nom@corsicalinea.com"
          required
          spellCheck={false}
          type="email"
        />
      </div>
      <div className="space-y-2">
        <label className="field-label" htmlFor="password">
          Mot de passe
        </label>
        <input
          aria-describedby={errorId}
          aria-invalid={Boolean(state.error)}
          autoComplete="current-password"
          className="field-input"
          disabled={pending}
          id="password"
          name="password"
          placeholder="Votre mot de passe"
          required
          type="password"
        />
      </div>
      {state.error ? (
        <p
          className="border-l-2 border-red-600 bg-red-50 px-4 py-3 text-sm leading-6 text-red-900"
          id="login-error"
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
        {pending ? 'Connexion…' : 'Se connecter'}
      </button>
    </form>
  );
}
