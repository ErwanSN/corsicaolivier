import { Injectable, NotFoundException } from '@nestjs/common';

import type { AuthIdentity } from '../auth/auth-context';
import { throwForSupabaseError } from '../common/supabase-error';
import type { Database } from '../database/database.types';
import { SupabaseService } from '../database/supabase.service';
import type { ListNotificationsQuery } from './notifications.dto';

type AgentNotification =
  Database['public']['Tables']['agent_notifications']['Row'];
type NotificationPayload = Readonly<{
  id: string;
  organizationId: string;
  siteId: string;
  agentId: string;
  scenarioId: string | null;
  status: AgentNotification['status'];
  channel: AgentNotification['channel'];
  subject: string;
  body: string;
  sentAt: string | null;
  acknowledgedAt: string | null;
  createdAt: string;
}>;
type NotificationPage = Readonly<{
  items: NotificationPayload[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}>;

function notificationPayload(item: AgentNotification): NotificationPayload {
  return {
    id: item.id,
    organizationId: item.organization_id,
    siteId: item.site_id,
    agentId: item.agent_id,
    scenarioId: item.scenario_id,
    status: item.status,
    channel: item.channel,
    subject: item.subject,
    body: item.body,
    sentAt: item.sent_at,
    acknowledgedAt: item.acknowledged_at,
    createdAt: item.created_at,
  };
}

function escapePostgrestLikeTerm(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll('%', '\\%')
    .replaceAll('_', '\\_')
    .replaceAll('*', '\\*');
}

@Injectable()
export class NotificationsService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(
    auth: AuthIdentity,
    input: ListNotificationsQuery,
  ): Promise<NotificationPage> {
    const client = this.supabase.forUser(auth.accessToken);
    const requestedPage = input.page ?? 1;
    const pageSize = input.pageSize ?? 30;
    const search = input.q?.trim();
    const agentResult = await client
      .from('agents')
      .select('id')
      .eq('user_id', auth.userId)
      .eq('active', true)
      .maybeSingle();

    throwForSupabaseError(agentResult.error, 'identification du collaborateur');
    if (!agentResult.data) {
      return {
        items: [],
        page: 1,
        pageSize,
        total: 0,
        totalPages: 1,
        hasMore: false,
      };
    }
    const agentId = agentResult.data.id;

    const pageQuery = (page: number) => {
      let query = client
        .from('agent_notifications')
        .select('*', { count: 'exact' })
        .eq('agent_id', agentId)
        .eq('channel', 'in_app')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (input.unreadOnly) {
        query = query.not('status', 'in', '(acknowledged,cancelled)');
      }
      if (search) {
        const term = `%${escapePostgrestLikeTerm(search)}%`;
        query = query.or(`subject.ilike."${term}",body.ilike."${term}"`);
      }
      return query;
    };

    const initialPage = await pageQuery(requestedPage);
    throwForSupabaseError(initialPage.error, 'chargement des notifications');
    const total = initialPage.count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requestedPage, totalPages);
    let items = initialPage.data ?? [];

    if (page !== requestedPage) {
      const resolvedPage = await pageQuery(page);
      throwForSupabaseError(resolvedPage.error, 'chargement des notifications');
      items = resolvedPage.data ?? [];
    }

    return {
      items: items.map(notificationPayload),
      page,
      pageSize,
      total,
      totalPages,
      hasMore: page < totalPages,
    };
  }

  async acknowledge(accessToken: string, notificationId: string) {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .rpc('acknowledge_my_notification', {
        target_notification_id: notificationId,
      });

    throwForSupabaseError(error, 'confirmation de la notification');

    if (data === null) {
      throw new NotFoundException('Notification introuvable.');
    }

    return data;
  }
}
