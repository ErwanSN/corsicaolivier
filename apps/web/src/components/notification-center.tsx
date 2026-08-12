'use client';

import { useActionState, useId } from 'react';
import { useFormStatus } from 'react-dom';

import {
  acknowledgeNotification,
  type NotificationActionState,
} from '../app/tools/notification-actions';
import type { AgentNotification } from '../lib/api/types';

type NotificationCenterProps = Readonly<{
  hasMore: boolean;
  loadError: boolean;
  notifications: ReadonlyArray<AgentNotification>;
  total: number;
  variant: 'desktop' | 'mobile';
}>;

const DATE_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Paris',
});

const INITIAL_ACTION_STATE: NotificationActionState = {
  error: null,
  acknowledged: false,
};

function notificationDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date inconnue'
    : DATE_FORMATTER.format(date);
}

function BellIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 shrink-0"
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path
        d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"
        stroke="currentColor"
        strokeLinecap="square"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function AcknowledgeButton({ subject }: Readonly<{ subject: string }>) {
  const { pending } = useFormStatus();

  return (
    <button
      aria-label={`Marquer « ${subject} » comme lue`}
      className="shrink-0 border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-zinc-950 hover:text-zinc-950 disabled:cursor-wait disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? 'En cours…' : 'Marquer comme lue'}
    </button>
  );
}

function NotificationItem({
  notification,
}: Readonly<{ notification: AgentNotification }>) {
  const [state, formAction] = useActionState(
    acknowledgeNotification,
    INITIAL_ACTION_STATE,
  );

  return (
    <li className="border-t border-zinc-100 px-4 py-3 first:border-t-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-950">
            {notification.subject}
          </p>
          <p className="mt-1 whitespace-pre-line text-sm leading-5 text-zinc-600">
            {notification.body}
          </p>
          <time
            className="mt-1.5 block text-xs text-zinc-400"
            dateTime={notification.createdAt}
          >
            {notificationDate(notification.createdAt)}
          </time>
        </div>
      </div>
      <form action={formAction} className="mt-3">
        <input name="notificationId" type="hidden" value={notification.id} />
        <AcknowledgeButton subject={notification.subject} />
      </form>
      {state.error ? (
        <p className="mt-2 text-xs text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.acknowledged ? (
        <p className="sr-only" role="status">
          Notification marquée comme lue.
        </p>
      ) : null}
    </li>
  );
}

export function NotificationCenter({
  hasMore,
  loadError,
  notifications,
  total,
  variant,
}: NotificationCenterProps) {
  const panelId = useId();
  const unreadCount = total;
  const summaryLabel = loadError
    ? 'Notifications indisponibles'
    : unreadCount === 0
      ? 'Notifications, aucune non lue'
      : `Notifications, ${unreadCount} non lue${unreadCount > 1 ? 's' : ''}`;
  const desktop = variant === 'desktop';

  return (
    <details className="relative" data-notification-center={variant}>
      <summary
        aria-controls={panelId}
        aria-label={summaryLabel}
        className={`flex list-none items-center text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950 focus:ring-2 focus:ring-red-100 focus:outline-none [&::-webkit-details-marker]:hidden ${
          desktop
            ? 'h-10 w-full justify-between border border-zinc-200 bg-white px-3'
            : 'h-9 min-w-9 justify-center border border-zinc-300 bg-white px-2'
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <BellIcon />
          {desktop ? <span>Notifications</span> : null}
        </span>
        {unreadCount > 0 ? (
          <span
            aria-hidden="true"
            className={`${desktop ? '' : 'ml-1'} min-w-5 bg-red-600 px-1.5 py-0.5 text-center text-[0.6875rem] font-bold leading-4 text-white`}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </summary>

      <section
        aria-label="Notifications non lues"
        className={`z-50 max-h-[min(70svh,32rem)] overflow-y-auto border border-zinc-300 bg-white shadow-xl ${
          desktop
            ? 'absolute bottom-0 left-[calc(100%+0.75rem)] w-96'
            : 'fixed inset-x-3 top-[4.25rem]'
        }`}
        id={panelId}
      >
        <header className="sticky top-0 flex items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-950">
              Notifications
            </h2>
            <p className="text-xs text-zinc-500">Non lues uniquement</p>
          </div>
          {!loadError && unreadCount > 0 ? (
            <span className="text-xs font-medium text-zinc-500">
              {unreadCount} en attente
            </span>
          ) : null}
        </header>

        {loadError ? (
          <p className="px-4 py-6 text-sm text-red-700" role="alert">
            Les notifications sont momentanément indisponibles. Réessayez en
            actualisant la page.
          </p>
        ) : unreadCount === 0 ? (
          <p
            className="px-4 py-8 text-center text-sm text-zinc-500"
            role="status"
          >
            Vous êtes à jour.
          </p>
        ) : (
          <>
            {hasMore ? (
              <p className="border-b border-zinc-100 px-4 py-2 text-xs text-zinc-500">
                {notifications.length} plus récentes affichées sur {total}. Les
                suivantes apparaissent au fil de leur traitement.
              </p>
            ) : null}
            <ul>
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                />
              ))}
            </ul>
          </>
        )}
      </section>
    </details>
  );
}
