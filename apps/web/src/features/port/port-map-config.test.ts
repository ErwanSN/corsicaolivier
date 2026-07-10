import { describe, expect, it } from "vitest";

import { defaultPortMapConfig, readPortMapConfig } from "./port-map-config";

describe("port map configuration", () => {
  it("restores a valid persisted configuration", () => {
    expect(readPortMapConfig(JSON.stringify(defaultPortMapConfig))).toEqual(defaultPortMapConfig);
  });

  it.each([null, "invalid json", '{"version":1,"points":[{}],"routes":[]}'])(
    "falls back safely for malformed storage",
    (value) => {
      expect(readPortMapConfig(value)).toEqual(defaultPortMapConfig);
    }
  );
});
