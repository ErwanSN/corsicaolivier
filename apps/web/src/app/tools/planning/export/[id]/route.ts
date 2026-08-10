import { NextResponse } from 'next/server';

import { proxyPlanningExport } from '../export-response';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  context: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: 'Planning invalide.' }, { status: 400 });
  }

  return proxyPlanningExport(
    `/api/schedule-versions/${id}/export.xlsx`,
    `planning-${id}.xlsx`,
  );
}
