'use server';

import { revalidatePath } from 'next/cache';

import { apiFetch } from '../../lib/api/server';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type NotificationActionState = Readonly<{
  error: string | null;
  acknowledged: boolean;
}>;

export async function acknowledgeNotification(
  _previousState: NotificationActionState,
  formData: FormData,
): Promise<NotificationActionState> {
  const notificationId = formData.get('notificationId');

  if (
    typeof notificationId !== 'string' ||
    !UUID_PATTERN.test(notificationId)
  ) {
    return {
      error: 'Cette notification est invalide. Actualisez la page.',
      acknowledged: false,
    };
  }

  const result = await apiFetch<{
    id: string;
    status: 'acknowledged';
    acknowledgedAt: string;
  }>(`/notifications/${notificationId}/ack`, { method: 'POST' });

  if (result.error) {
    return {
      error: 'Impossible de marquer cette notification comme lue.',
      acknowledged: false,
    };
  }

  revalidatePath('/tools', 'layout');

  return { error: null, acknowledged: true };
}
