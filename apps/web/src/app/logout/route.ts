import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '../../lib/supabase/server';

export async function POST() {
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

  return new NextResponse(null, {
    status: 303,
    headers: { Location: '/login' },
  });
}
