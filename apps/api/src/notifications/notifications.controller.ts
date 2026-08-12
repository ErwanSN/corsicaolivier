import {
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';

import type { AuthIdentity } from '../auth/auth-context';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { requireAuth } from '../common/require-auth';
import { ListNotificationsQuery } from './notifications.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Query() query: ListNotificationsQuery,
  ) {
    return this.notifications.list(requireAuth(auth), query);
  }

  @Post(':id/ack')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  acknowledge(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Param('id', ParseUUIDPipe) notificationId: string,
  ) {
    return this.notifications.acknowledge(
      requireAuth(auth).accessToken,
      notificationId,
    );
  }
}
