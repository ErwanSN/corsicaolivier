import ExcelJS from 'exceljs';

import {
  buildPlanningWorkbook,
  type PlanningExportData,
} from './planning-export';

describe('buildPlanningWorkbook', () => {
  it('génère une semaine Excel avec la palette exacte du corpus', async () => {
    const data = {
      agents: [{ id: 'agent-1', display_name: 'Alice Martin' }],
      assignments: [
        {
          id: 'assignment-1',
          planning_shift_id: 'shift-1',
          position_id: 'position-auto',
          staffing_requirement_id: 'requirement-1',
          port_call_id: 'call-1',
          starts_at: '2026-07-20T02:30:00.000Z',
          ends_at: '2026-07-20T09:30:00.000Z',
        },
      ],
      forecasts: [
        {
          id: 'forecast-1',
          port_call_id: 'call-1',
          passenger_count: 570,
          passenger_quota: 38,
          vehicle_count: 461,
          freight_unit_count: 12,
          coach_count: 2,
          received_at: '2026-07-19T07:00:00.000Z',
        },
      ],
      period: {
        id: 'period-1',
        name: 'Semaine du 20 juillet',
        starts_on: '2026-07-20',
        ends_on: '2026-07-26',
        timezone: 'Europe/Paris',
      },
      portCalls: [
        {
          id: 'call-1',
          vessel_id: 'vessel-1',
          external_reference: 'DEMO-ROT-0720',
          status: 'scheduled',
          scheduled_arrival_at: '2026-07-20T04:30:00.000Z',
          scheduled_departure_at: '2026-07-20T06:00:00.000Z',
          estimated_arrival_at: null,
          estimated_departure_at: null,
        },
      ],
      positions: [
        { id: 'position-auto', code: 'CA-03-GUICHETS', name: 'Guichets' },
        { id: 'position-fret', code: 'FRET-02-PORTIQUE', name: 'Portique' },
      ],
      requirements: [
        {
          id: 'requirement-1',
          position_id: 'position-auto',
          port_call_id: 'call-1',
          starts_at: '2026-07-20T02:30:00.000Z',
          ends_at: '2026-07-20T09:30:00.000Z',
          required_agents: 1,
        },
      ],
      shifts: [{ id: 'shift-1', agent_id: 'agent-1' }],
      siteName: 'Marseille Joliette',
      vessels: [{ id: 'vessel-1', name: 'Pascal Paoli' }],
      version: { label: 'Planning initial' },
    } as unknown as PlanningExportData;

    const file = await buildPlanningWorkbook(data);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(new Uint8Array(file.buffer).buffer);
    const sheet = workbook.getWorksheet('Planning semaine');

    expect(sheet).toBeDefined();
    expect(file.fileName).toBe('planning-2026-07-20-planning-initial.xlsx');
    expect(sheet?.getCell('B3').value).toContain('Pascal Paoli');
    expect(sheet?.getCell('B5').value).toContain('570 pax');
    expect(fillColor(sheet?.getCell('A1'))).toBe('FFC0C0C0');
    expect(fillColor(sheet?.getCell('G2'))).toBe('FFFFFF00');
    expect(fillColor(sheet?.getCell('B7'))).toBe('FF99CC00');
    expect(fillColor(sheet?.getCell('A8'))).toBe('FF969696');
  });
});

function fillColor(cell: ExcelJS.Cell | undefined): string | undefined {
  if (!cell || cell.fill.type !== 'pattern') return undefined;
  return cell.fill.fgColor?.argb;
}
