import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';

export function throwForSupabaseError(
  error: PostgrestError | null,
  operation: string,
): void {
  if (!error) {
    return;
  }

  if (error.code === '23505') {
    throw new ConflictException('Cette référence existe déjà.');
  }

  if (/^P20\d{2}$/.test(error.code)) {
    throw new ConflictException(error.message);
  }

  throw new ServiceUnavailableException(
    `L’opération « ${operation} » est momentanément indisponible.`,
  );
}
