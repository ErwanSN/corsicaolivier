'use client';

import { useActionState } from 'react';

import { login, type LoginState } from './actions';

const initialState: LoginState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(login, initialState);

  return (
    <form action={action} className="mt-8 space-y-5">
      <div className="space-y-2">
        <label className="field-label" htmlFor="email">
          Adresse professionnelle
        </label>
        <input
          autoComplete="email"
          className="field-input"
          id="email"
          name="email"
          placeholder="prenom.nom@corsicalinea.com"
          required
          type="email"
        />
      </div>
      <div className="space-y-2">
        <label className="field-label" htmlFor="password">
          Mot de passe
        </label>
        <input
          autoComplete="current-password"
          className="field-input"
          id="password"
          name="password"
          required
          type="password"
        />
      </div>
      {state.error ? (
        <p
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
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
        {pending ? 'Connexion…' : 'Accéder au Tools Panel'}
      </button>
    </form>
  );
}
