import ExcelJS from 'exceljs';

import type { Database } from '../database/database.types';

type Row<TableName extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][TableName]['Row'];

export type PlanningExportData = Readonly<{
  agents: Row<'agents'>[];
  assignments: Row<'shift_assignments'>[];
  forecasts: Row<'call_load_forecasts'>[];
  period: Pick<
    Row<'planning_periods'>,
    'id' | 'name' | 'starts_on' | 'ends_on' | 'timezone'
  >;
  portCalls: Row<'port_calls'>[];
  positions: Row<'positions'>[];
  requirements: Row<'staffing_requirements'>[];
  shifts: Row<'planning_shifts'>[];
  siteName: string;
  vessels: Row<'vessels'>[];
  version: Pick<Row<'schedule_versions'>, 'label'>;
}>;

export type PlanningExportFile = Readonly<{
  buffer: Buffer;
  fileName: string;
}>;

const COLORS = {
  black: 'FF000000',
  white: 'FFFFFFFF',
  silver: 'FFC0C0C0',
  darkSilver: 'FF969696',
  yellow: 'FFFFFF00',
  green: 'FF99CC00',
} as const;

const DAYS = 7;
const FIRST_DAY_COLUMN = 2;

export async function buildPlanningWorkbook(
  data: PlanningExportData,
): Promise<PlanningExportFile> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Corsica Linea';
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.subject = `Planning ${data.period.name}`;
  workbook.title = data.version.label;

  const sheet = workbook.addWorksheet('Planning semaine', {
    pageSetup: {
      fitToPage: true,
      fitToHeight: 1,
      fitToWidth: 1,
      orientation: 'landscape',
      paperSize: 9,
    },
    properties: { defaultRowHeight: 22 },
    views: [{ showGridLines: false, state: 'frozen', xSplit: 1, ySplit: 2 }],
  });
  const days = Array.from({ length: DAYS }, (_, index) =>
    addDays(data.period.starts_on, index),
  );
  const agentById = new Map(data.agents.map((agent) => [agent.id, agent]));
  const shiftById = new Map(data.shifts.map((shift) => [shift.id, shift]));
  const vesselById = new Map(data.vessels.map((vessel) => [vessel.id, vessel]));
  const latestForecastByCall = latestForecasts(data.forecasts);

  sheet.getColumn(1).width = 26;
  for (
    let column = FIRST_DAY_COLUMN;
    column < FIRST_DAY_COLUMN + DAYS;
    column += 1
  ) {
    sheet.getColumn(column).width = 27;
  }

  sheet.mergeCells('A1:H1');
  const title = sheet.getCell('A1');
  title.value = `${data.siteName.toUpperCase()} · ${data.period.name} · ${data.version.label}`;
  title.alignment = { horizontal: 'left', vertical: 'middle' };
  title.font = { bold: true, color: { argb: COLORS.black }, size: 14 };
  title.fill = solidFill(COLORS.silver);
  title.border = allBorders(COLORS.darkSilver, 'medium');
  sheet.getRow(1).height = 30;

  const headerRow = sheet.getRow(2);
  headerRow.getCell(1).value = 'POSTES / JOURS';
  days.forEach((day, index) => {
    const cell = headerRow.getCell(FIRST_DAY_COLUMN + index);
    cell.value = dayHeader(day);
    cell.fill = solidFill(isWeekend(day) ? COLORS.yellow : COLORS.silver);
  });
  styleRow(headerRow, COLORS.silver, true);
  days.forEach((day, index) => {
    if (isWeekend(day)) {
      headerRow.getCell(FIRST_DAY_COLUMN + index).fill = solidFill(
        COLORS.yellow,
      );
    }
  });
  headerRow.height = 34;

  appendMovementRow('ARRIVÉES', 'arrival');
  appendMovementRow('DÉPARTS', 'departure');
  appendLoadRow();

  const autoPositions = data.positions.filter(
    (position) => !position.code.startsWith('FRET-'),
  );
  const freightPositions = data.positions.filter((position) =>
    position.code.startsWith('FRET-'),
  );

  appendSectionRow('CENTRE AUTOS', COLORS.silver, COLORS.black);
  autoPositions.forEach(appendPositionRow);
  if (freightPositions.length) {
    appendSectionRow('FRET', COLORS.darkSilver, COLORS.white);
    freightPositions.forEach(appendPositionRow);
  }

  const lastRow = sheet.rowCount;
  sheet.autoFilter = { from: 'A2', to: 'H2' };
  sheet.pageSetup.printArea = `A1:H${lastRow}`;
  sheet.pageSetup.printTitlesRow = '1:2';
  sheet.headerFooter.oddFooter = '&LCorsica Linea&CPage &P / &N&RExport du &D';

  const raw = await workbook.xlsx.writeBuffer();
  return {
    buffer: Buffer.from(raw),
    fileName: `planning-${data.period.starts_on}-${slug(data.version.label)}.xlsx`,
  };

  function appendMovementRow(
    label: string,
    kind: 'arrival' | 'departure',
  ): void {
    const row = sheet.addRow([label]);
    days.forEach((day, index) => {
      const calls = data.portCalls.filter((call) => {
        const value =
          kind === 'arrival'
            ? (call.estimated_arrival_at ?? call.scheduled_arrival_at)
            : (call.estimated_departure_at ?? call.scheduled_departure_at);
        return value ? dateKey(value, data.period.timezone) === day : false;
      });
      const cell = row.getCell(FIRST_DAY_COLUMN + index);
      cell.value = calls.length
        ? calls
            .map((call) => {
              const value =
                kind === 'arrival'
                  ? (call.estimated_arrival_at ?? call.scheduled_arrival_at)
                  : (call.estimated_departure_at ??
                    call.scheduled_departure_at);
              const vessel = vesselById.get(call.vessel_id)?.name ?? 'Navire';
              const state = call.status === 'cancelled' ? ' · ANNULÉE' : '';
              return `${vessel} · ${timeLabel(value, data.period.timezone)}${state}`;
            })
            .join('\n')
        : '—';
      cell.fill = solidFill(
        calls.some((call) => call.status === 'cancelled')
          ? COLORS.darkSilver
          : calls.some(
                (call) =>
                  call.status === 'delayed' || call.status === 'advanced',
              )
            ? COLORS.yellow
            : COLORS.white,
      );
      cell.font = {
        color: {
          argb: calls.some((call) => call.status === 'cancelled')
            ? COLORS.white
            : COLORS.black,
        },
        size: 9,
      };
    });
    styleLabelCell(row.getCell(1));
    styleDataCells(row);
    row.height = 42;
  }

  function appendLoadRow(): void {
    const row = sheet.addRow(['PRÉV. CHARGE']);
    days.forEach((day, index) => {
      const calls = data.portCalls.filter((call) => {
        const arrival = call.estimated_arrival_at ?? call.scheduled_arrival_at;
        const departure =
          call.estimated_departure_at ?? call.scheduled_departure_at;
        return [arrival, departure].some(
          (value) => value && dateKey(value, data.period.timezone) === day,
        );
      });
      const lines = calls.flatMap((call) => {
        const forecast = latestForecastByCall.get(call.id);
        if (!forecast) return [];
        const vessel = vesselById.get(call.vessel_id)?.name ?? 'Navire';
        return [
          `${vessel} · ${forecast.passenger_count} pax · ${forecast.passenger_quota ?? 0} piétons · ${forecast.vehicle_count} véh. · ${forecast.freight_unit_count} fret · ${forecast.coach_count} cars`,
        ];
      });
      row.getCell(FIRST_DAY_COLUMN + index).value = lines.length
        ? lines.join('\n')
        : '—';
    });
    styleLabelCell(row.getCell(1));
    styleDataCells(row);
    row.height = 42;
  }

  function appendSectionRow(
    label: string,
    color: string,
    fontColor: string,
  ): void {
    const row = sheet.addRow([label]);
    sheet.mergeCells(row.number, 1, row.number, 8);
    styleRow(row, color, true, fontColor);
    row.height = 24;
  }

  function appendPositionRow(position: Row<'positions'>): void {
    const row = sheet.addRow([position.name]);
    styleLabelCell(row.getCell(1));

    days.forEach((day, index) => {
      const assignments = data.assignments.filter(
        (assignment) =>
          assignment.position_id === position.id &&
          dateKey(assignment.starts_at, data.period.timezone) === day,
      );
      const requirements = data.requirements.filter(
        (requirement) =>
          requirement.position_id === position.id &&
          dateKey(requirement.starts_at, data.period.timezone) === day,
      );
      const cell = row.getCell(FIRST_DAY_COLUMN + index);
      const assignmentLines = assignments.map((assignment) => {
        const shift = shiftById.get(assignment.planning_shift_id);
        const agent = shift ? agentById.get(shift.agent_id) : undefined;
        return `${agent?.display_name ?? 'Agent'}\n${timeLabel(assignment.starts_at, data.period.timezone)}–${timeLabel(assignment.ends_at, data.period.timezone)}`;
      });
      const underCovered = requirements.some(
        (requirement) =>
          minimumConcurrentCoverage(requirement, assignments) <
          requirement.required_agents,
      );
      const requirementLines = requirements.map((requirement) => {
        const covered = minimumConcurrentCoverage(requirement, assignments);
        return `Besoin ${timeLabel(requirement.starts_at, data.period.timezone)}–${timeLabel(requirement.ends_at, data.period.timezone)} · ${covered}/${requirement.required_agents}`;
      });

      cell.value = [...assignmentLines, ...requirementLines].join('\n') || '—';
      cell.fill = solidFill(
        underCovered
          ? COLORS.yellow
          : assignments.length
            ? COLORS.green
            : COLORS.white,
      );
    });
    styleDataCells(row);
    row.height = Math.max(
      34,
      ...days.map((_, index) => {
        const rawValue = row.getCell(FIRST_DAY_COLUMN + index).value;
        const value =
          typeof rawValue === 'string' || typeof rawValue === 'number'
            ? String(rawValue)
            : '';
        return 18 + value.split('\n').length * 13;
      }),
    );
  }
}

function styleRow(
  row: ExcelJS.Row,
  fillColor: string,
  bold = false,
  fontColor: string = COLORS.black,
): void {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = solidFill(fillColor);
    cell.font = { bold, color: { argb: fontColor }, size: 9 };
    cell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true,
    };
    cell.border = allBorders(COLORS.darkSilver);
  });
}

function styleLabelCell(cell: ExcelJS.Cell): void {
  cell.fill = solidFill(COLORS.silver);
  cell.font = { bold: true, color: { argb: COLORS.black }, size: 9 };
  cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
  cell.border = allBorders(COLORS.darkSilver);
}

function styleDataCells(row: ExcelJS.Row): void {
  for (
    let column = FIRST_DAY_COLUMN;
    column < FIRST_DAY_COLUMN + DAYS;
    column += 1
  ) {
    const cell = row.getCell(column);
    cell.alignment = {
      horizontal: 'left',
      vertical: 'top',
      wrapText: true,
    };
    cell.border = allBorders(COLORS.silver);
    cell.font ??= { color: { argb: COLORS.black }, size: 9 };
  }
}

function solidFill(color: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
}

function allBorders(
  color: string,
  style: ExcelJS.BorderStyle = 'thin',
): Partial<ExcelJS.Borders> {
  const border = { style, color: { argb: color } };
  return { top: border, right: border, bottom: border, left: border };
}

function addDays(date: string, count: number): string {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + count);
  return value.toISOString().slice(0, 10);
}

function dateKey(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  }).format(new Date(value));
}

function timeLabel(value: string | null, timeZone: string): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(new Date(value));
}

function dayHeader(day: string): string {
  const value = new Date(`${day}T12:00:00.000Z`);
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  })
    .format(value)
    .toUpperCase();
}

function isWeekend(day: string): boolean {
  const weekday = new Date(`${day}T12:00:00.000Z`).getUTCDay();
  return weekday === 0 || weekday === 6;
}

function latestForecasts(
  forecasts: Row<'call_load_forecasts'>[],
): Map<string, Row<'call_load_forecasts'>> {
  const result = new Map<string, Row<'call_load_forecasts'>>();
  for (const forecast of [...forecasts].sort((left, right) =>
    right.received_at.localeCompare(left.received_at),
  )) {
    if (!result.has(forecast.port_call_id)) {
      result.set(forecast.port_call_id, forecast);
    }
  }
  return result;
}

function minimumConcurrentCoverage(
  requirement: Row<'staffing_requirements'>,
  assignments: Row<'shift_assignments'>[],
): number {
  const requirementStart = new Date(requirement.starts_at).getTime();
  const requirementEnd = new Date(requirement.ends_at).getTime();
  const relevant = assignments
    .filter(
      (assignment) =>
        assignment.staffing_requirement_id === requirement.id ||
        (!assignment.staffing_requirement_id &&
          assignment.port_call_id === requirement.port_call_id),
    )
    .map((assignment) => ({
      start: Math.max(
        requirementStart,
        new Date(assignment.starts_at).getTime(),
      ),
      end: Math.min(requirementEnd, new Date(assignment.ends_at).getTime()),
    }))
    .filter((interval) => interval.end > interval.start);
  const boundaries = [
    requirementStart,
    requirementEnd,
    ...relevant.flatMap((interval) => [interval.start, interval.end]),
  ].sort((left, right) => left - right);
  let minimum = Number.POSITIVE_INFINITY;

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const start = boundaries[index];
    const end = boundaries[index + 1];
    if (end <= start) continue;
    const midpoint = start + (end - start) / 2;
    const coverage = relevant.filter(
      (interval) => interval.start <= midpoint && interval.end >= midpoint,
    ).length;
    minimum = Math.min(minimum, coverage);
  }
  return Number.isFinite(minimum) ? minimum : 0;
}

function slug(value: string): string {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return normalized || 'semaine';
}
