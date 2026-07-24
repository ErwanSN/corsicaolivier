import type { SupabaseService } from '../database/supabase.service';
import { AgentsService } from './agents.service';

const agent = {
  id: '00000000-0000-4000-8000-000000000501',
  organization_id: '00000000-0000-4000-8000-000000000001',
  primary_site_id: '00000000-0000-4000-8000-000000000101',
  user_id: null,
  employee_number: 'MRS-501',
  display_name: 'AGENT TEST',
  active: true,
  hired_on: null,
  left_on: null,
  created_at: '2026-07-19T00:00:00.000Z',
  updated_at: '2026-07-19T00:00:00.000Z',
};

describe('AgentsService', () => {
  it('génère un identifiant technique quand le matricule est inconnu', async () => {
    const single = jest.fn().mockResolvedValue({ data: agent, error: null });
    const select = jest.fn().mockReturnValue({ single });
    const insertedPayloads: unknown[] = [];
    const insert = jest.fn((value: unknown) => {
      insertedPayloads.push(value);
      return { select };
    });
    const from = jest.fn().mockReturnValue({ insert });
    const forUser = jest.fn().mockReturnValue({ from });
    const service = new AgentsService({
      forUser,
    } as unknown as SupabaseService);

    await service.create('access-token', {
      organizationId: agent.organization_id,
      primarySiteId: agent.primary_site_id,
      displayName: agent.display_name,
    });

    const inserted = insertedPayloads.at(0);
    expect(inserted).toEqual(
      expect.objectContaining({ display_name: agent.display_name }),
    );
    expect(
      (inserted as Readonly<{ employee_number: string }>).employee_number,
    ).toMatch(/^AG-[A-F0-9]{12}$/);
  });

  it('modifie seulement la fiche ciblée dans son organisation', async () => {
    const single = jest.fn().mockResolvedValue({ data: agent, error: null });
    const select = jest.fn().mockReturnValue({ single });
    const organizationEq = jest.fn().mockReturnValue({ select });
    const idEq = jest.fn().mockReturnValue({ eq: organizationEq });
    const update = jest.fn().mockReturnValue({ eq: idEq });
    const from = jest.fn().mockReturnValue({ update });
    const forUser = jest.fn().mockReturnValue({ from });
    const service = new AgentsService({
      forUser,
    } as unknown as SupabaseService);

    await service.update('access-token', agent.id, {
      organizationId: agent.organization_id,
      primarySiteId: agent.primary_site_id,
      employeeNumber: agent.employee_number,
      displayName: 'NOUVEAU NOM',
      active: false,
      hiredOn: null,
      leftOn: '2026-07-31',
    });

    expect(update).toHaveBeenCalledWith({
      primary_site_id: agent.primary_site_id,
      employee_number: agent.employee_number,
      display_name: 'NOUVEAU NOM',
      active: false,
      hired_on: null,
      left_on: '2026-07-31',
    });
    expect(idEq).toHaveBeenCalledWith('id', agent.id);
    expect(organizationEq).toHaveBeenCalledWith(
      'organization_id',
      agent.organization_id,
    );
  });
});
