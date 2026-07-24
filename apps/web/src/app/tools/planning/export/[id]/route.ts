import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '../../../../../lib/supabase/server';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  context: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: 'Planning invalide.' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data } = (await supabase?.auth.getSession()) ?? {
    data: { session: null },
  };
  if (!data.session?.access_token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001';
  const response = await fetch(
    new URL(`/api/schedule-versions/${id}/export.xlsx`, apiUrl),
    {
      cache: 'no-store',
      headers: {
        Accept:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        Authorization: `Bearer ${data.session.access_token}`,
      },
    },
  );

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
        `attachment; filename="planning-${id}.xlsx"`,
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
  });
}
