import { describe, expect, it, vi } from "vitest";

import { configureWorkerLifecycle } from "./worker-lifecycle";

describe("configureWorkerLifecycle", () => {
  it("enables graceful shutdown hooks", () => {
    const enableShutdownHooks = vi.fn();
    configureWorkerLifecycle({ enableShutdownHooks });
    expect(enableShutdownHooks).toHaveBeenCalledOnce();
  });
});
