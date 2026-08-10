import { NextResponse } from 'next/server';

import { proxyPlanningExport } from '../export-response';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const siteId = url.searchParams.get('site') ?? '';
  const weekStart = url.searchParams.get('date') ?? '';

  if (!UUID_PATTERN.test(siteId) || !DATE_PATTERN.test(weekStart)) {
    return NextResponse.json(
      { error: 'Semaine ou zone invalide.' },
      { status: 400 },
    );
  }

  const params = new URLSearchParams({ siteId, weekStart });
  return proxyPlanningExport(
    `/api/planning/export.xlsx?${params.toString()}`,
    `planning-${weekStart}.xlsx`,
  );
}
