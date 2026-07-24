import type { SupabaseService } from '../database/supabase.service';
import { AccessControlService } from './access-control.service';
import type { AccessContext } from './auth-context';

describe('AccessControlService', () => {
  const service = new AccessControlService({} as SupabaseService);
  const context: AccessContext = {
    userId: '00000000-0000-4000-8000-000000000010',
    displayName: 'Planificateur',
    status: 'active',
    assignments: [
      {
        role: 'planner',
        organizationId: '00000000-0000-4000-8000-000000000001',
        siteId: '00000000-0000-4000-8000-000000000101',
        validFrom: '2026-07-19T00:00:00Z',
        validUntil: null,
      },
    ],
  };

  it('autorise le rôle sur son site', () => {
    expect(
      service.hasAnyRole(
        context,
        ['planner'],
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000101',
      ),
    ).toBe(true);
  });

  it('refuse le même rôle sur un autre site', () => {
    expect(
      service.hasAnyRole(
        context,
        ['planner'],
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000102',
      ),
    ).toBe(false);
  });

  it('refuse un rôle métier sans organisation explicite', () => {
    expect(service.hasAnyRole(context, ['planner'])).toBe(false);
  });

  it('autorise un administrateur de plateforme sur tout périmètre', () => {
    const platformContext: AccessContext = {
      ...context,
      assignments: [
        {
          role: 'platform_admin',
          organizationId: null,
          siteId: null,
          validFrom: '2026-07-19T00:00:00Z',
          validUntil: null,
        },
      ],
    };

    expect(service.hasAnyRole(platformContext, ['platform_admin'])).toBe(true);
  });
});
