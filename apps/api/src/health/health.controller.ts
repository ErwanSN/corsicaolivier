import { Controller, Get } from '@nestjs/common';

import { Public } from '../auth/public.decorator';

type HealthResponse = Readonly<{
  status: 'ok';
}>;

@Controller('health')
@Public()
export class HealthController {
  @Get()
  check(): HealthResponse {
    return { status: 'ok' };
  }
}
