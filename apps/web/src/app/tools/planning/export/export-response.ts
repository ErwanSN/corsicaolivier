import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '../../../../lib/supabase/server';

const EXCEL_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const EXPORT_TIMEOUT_MS = 30_000;
const MAX_EXPORT_BYTES = 25 * 1024 * 1024;

class ExportTooLargeError extends Error {}

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
  const timeoutSignal = AbortSignal.timeout(EXPORT_TIMEOUT_MS);

  try {
    const response = await fetch(new URL(apiPath, apiUrl), {
      cache: 'no-store',
      headers: {
        Accept: EXCEL_CONTENT_TYPE,
        Authorization: `Bearer ${data.session.access_token}`,
      },
      signal: timeoutSignal,
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Impossible de générer le fichier Excel.' },
        { status: response.status },
      );
    }

    const declaredSize = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredSize) && declaredSize > MAX_EXPORT_BYTES) {
      await response.body?.cancel();
      return NextResponse.json(
        { error: 'Le fichier Excel dépasse la taille autorisée.' },
        { status: 413 },
      );
    }

    const body = await readLimitedBody(response, MAX_EXPORT_BYTES);

    return new Response(body, {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition':
          response.headers.get('content-disposition') ??
          `attachment; filename="${fallbackFileName}"`,
        'Content-Type': EXCEL_CONTENT_TYPE,
      },
    });
  } catch (error) {
    if (error instanceof ExportTooLargeError) {
      return NextResponse.json(
        { error: 'Le fichier Excel dépasse la taille autorisée.' },
        { status: 413 },
      );
    }

    return NextResponse.json(
      {
        error: timeoutSignal.aborted
          ? 'La génération du fichier Excel a expiré.'
          : 'Le service d’export est momentanément indisponible.',
      },
      { status: timeoutSignal.aborted ? 504 : 502 },
    );
  }
}

async function readLimitedBody(
  response: Response,
  limit: number,
): Promise<ArrayBuffer> {
  if (!response.body) return new ArrayBuffer(0);

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteLength += value.byteLength;
    if (byteLength > limit) {
      await reader.cancel();
      throw new ExportTooLargeError();
    }
    chunks.push(value);
  }

  const body = new ArrayBuffer(byteLength);
  const view = new Uint8Array(body);
  let offset = 0;
  for (const chunk of chunks) {
    view.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}
