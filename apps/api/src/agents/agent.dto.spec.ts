import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { RetryAgentOffboardingDto, SearchAgentsQuery } from './agent.dto';

describe('SearchAgentsQuery', () => {
  it('convertit une pagination et une liste d’agents inclus valides', async () => {
    const input = plainToInstance(SearchAgentsQuery, {
      includeIds:
        '00000000-0000-4000-8000-000000000001,00000000-0000-4000-8000-000000000002',
      page: '3',
      pageSize: '25',
      q: '  marie  ',
      status: 'inactive',
    });

    await expect(validate(input)).resolves.toHaveLength(0);
    expect(input).toEqual(
      expect.objectContaining({
        includeIds: [
          '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000002',
        ],
        page: 3,
        pageSize: 25,
        q: 'marie',
        status: 'inactive',
      }),
    );
  });

  it('refuse les recherches et tailles de page hors limites', async () => {
    const input = plainToInstance(SearchAgentsQuery, {
      includeIds: Array.from(
        { length: 201 },
        () => '00000000-0000-4000-8000-000000000001',
      ),
      page: '0',
      pageSize: '101',
      q: 'x'.repeat(81),
      status: 'archived',
    });

    const errors = await validate(input);

    expect(errors.map((error) => error.property).sort()).toEqual([
      'includeIds',
      'page',
      'pageSize',
      'q',
      'status',
    ]);
  });

  it('refuse un identifiant inclus qui n’est pas un UUID', async () => {
    const input = plainToInstance(SearchAgentsQuery, {
      includeIds: 'agent-invalide',
    });

    const errors = await validate(input);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('includeIds');
    expect(errors[0].constraints).toHaveProperty('isUuid');
  });
});

describe('RetryAgentOffboardingDto', () => {
  it('exige une organisation et un motif borné', async () => {
    const valid = plainToInstance(RetryAgentOffboardingDto, {
      organizationId: '00000000-0000-4000-8000-000000000001',
      reason: 'Incident corrigé',
    });
    const invalid = plainToInstance(RetryAgentOffboardingDto, {
      organizationId: 'invalide',
      reason: 'x',
    });

    await expect(validate(valid)).resolves.toHaveLength(0);
    await expect(validate(invalid)).resolves.toHaveLength(2);
  });
});
