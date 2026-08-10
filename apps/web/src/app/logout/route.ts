import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '../../lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();

  if (supabase) {
    try {
      const { error } = await supabase.auth.signOut({ scope: 'global' });

      if (error) {
        await supabase.auth.signOut({ scope: 'local' });
      }
    } catch {
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        // La redirection reste prioritaire si la session est déjà expirée.
      }
    }
  }

  return NextResponse.redirect(new URL('/login', request.url), 303);
}
