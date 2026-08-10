import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '../../../../lib/supabase/server';

const EXCEL_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function proxyPlanningExport(
  apiPath: string,
  fallbackFileName: string,
): Promise<Response> {
  const supabase = await createSupabaseServerClient();
  const { data } = (await supabase?.auth.getSession()) ?? {
    data: { session: null },
  };

  if (!data.session?.access_token) {
    return new Response(null, {
      status: 303,
      headers: { Location: '/login' },
    });
  }

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001';
  const response = await fetch(new URL(apiPath, apiUrl), {
    cache: 'no-store',
    headers: {
      Accept: EXCEL_CONTENT_TYPE,
      Authorization: `Bearer ${data.session.access_token}`,
    },
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: 'Impossible de générer le fichier Excel.' },
      { status: response.status },
    );
  }

  return new Response(await response.arrayBuffer(), {
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Disposition':
        response.headers.get('content-disposition') ??
        `attachment; filename="${fallbackFileName}"`,
      'Content-Type': EXCEL_CONTENT_TYPE,
    },
  });
}
