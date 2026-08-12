import { ThrottlerGuard } from '@nestjs/throttler';

export abstract class NamedThrottlerGuard extends ThrottlerGuard {
  protected abstract readonly throttlerName: string;

  override async onModuleInit(): Promise<void> {
    await super.onModuleInit();
    this.throttlers = this.throttlers.filter(
      ({ name }) => name === this.throttlerName,
    );
  }
}
