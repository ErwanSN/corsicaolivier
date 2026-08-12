import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ListPositionsQuery } from './position.dto';

describe('ListPositionsQuery', () => {
  it('convertit une recherche paginée bornée à 200 postes', async () => {
    const input = plainToInstance(ListPositionsQuery, {
      organizationId: '00000000-0000-4000-8000-000000000001',
      siteId: '00000000-0000-4000-8000-000000000002',
      page: '2',
      pageSize: '200',
      q: '  accueil  ',
    });

    await expect(validate(input)).resolves.toHaveLength(0);
    expect(input.page).toBe(2);
    expect(input.pageSize).toBe(200);
    expect(input.q).toBe('accueil');
  });

  it('refuse une page trop grande', async () => {
    const input = plainToInstance(ListPositionsQuery, {
      organizationId: '00000000-0000-4000-8000-000000000001',
      pageSize: '201',
    });

    await expect(validate(input)).resolves.toHaveLength(1);
  });
});
