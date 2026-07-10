export type WorkerApplicationContext = Readonly<{
  enableShutdownHooks: () => void;
}>;

export function configureWorkerLifecycle(context: WorkerApplicationContext): void {
  context.enableShutdownHooks();
}
