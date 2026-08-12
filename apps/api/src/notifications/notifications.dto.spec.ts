import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ListNotificationsQuery } from './notifications.dto';

describe('ListNotificationsQuery', () => {
  it('convertit les paramètres HTTP bornés', async () => {
    const input = plainToInstance(ListNotificationsQuery, {
      page: '2',
      pageSize: '25',
      q: '  planning  ',
      unreadOnly: 'true',
    });

    await expect(validate(input)).resolves.toHaveLength(0);
    expect(input).toEqual({
      page: 2,
      pageSize: 25,
      q: 'planning',
      unreadOnly: true,
    });
  });

  it('refuse une limite excessive et un booléen ambigu', async () => {
    const input = plainToInstance(ListNotificationsQuery, {
      pageSize: '31',
      unreadOnly: 'yes',
    });

    await expect(validate(input)).resolves.toHaveLength(2);
  });
});
