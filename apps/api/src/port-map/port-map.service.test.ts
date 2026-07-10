import { describe, expect, it } from "vitest";
import { type PortMapConfig } from "@corsica/contracts";

import { normalizePortMapConfiguration } from "./port-map.service";

describe("normalizePortMapConfiguration", () => {
  it("derives route geometry exclusively from ordered points", () => {
    const configuration: PortMapConfig = {
      points: [
        {
          coordinates: [43.3, 5.36],
          id: "11111111-1111-4111-8111-111111111111",
          label: "Contrôle",
          type: "control"
        },
        {
          coordinates: [43.31, 5.35],
          id: "22222222-2222-4222-8222-222222222222",
          label: "Navire",
          type: "ship"
        }
      ],
      routes: [
        {
          geometry: [
            [0, 0],
            [1, 1]
          ],
          id: "33333333-3333-4333-8333-333333333333",
          label: "Embarquement",
          pointIds: [
            "11111111-1111-4111-8111-111111111111",
            "22222222-2222-4222-8222-222222222222"
          ],
          shipPointId: "22222222-2222-4222-8222-222222222222"
        }
      ],
      version: 3
    };
    expect(normalizePortMapConfiguration(configuration).routes[0]?.geometry).toEqual([
      [43.3, 5.36],
      [43.31, 5.35]
    ]);
  });
});
