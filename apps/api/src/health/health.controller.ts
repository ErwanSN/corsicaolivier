import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';

import { Public } from '../auth/public.decorator';
import { SupabaseService } from '../database/supabase.service';

type HealthResponse = Readonly<{
  status: 'ok';
}>;

@Controller('health')
@Public()
export class HealthController {
  constructor(private readonly supabase: SupabaseService) {}

  @Get()
  async check(): Promise<HealthResponse> {
    const dependencies = await this.supabase.checkHealth();

    if (!dependencies.auth || !dependencies.database || !dependencies.schema) {
      throw new ServiceUnavailableException({
        dependencies,
        status: 'unavailable',
      });
    }

    return { status: 'ok' };
  }
}
