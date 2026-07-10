import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { type Coordinates } from "./port-guide";
import { type PortMapConfig } from "./port-map-config";
import { usePortAdminEditor } from "./use-port-admin-editor";

const shipCoordinates: Coordinates = [43.31, 5.35];
const config: PortMapConfig = {
  points: [
    { coordinates: [43.3, 5.36], id: "control", label: "Contrôle", type: "control" },
    { coordinates: shipCoordinates, id: "ship", label: "A Galeotta", type: "ship" }
  ],
  routes: [],
  version: 3
};

describe("usePortAdminEditor", () => {
  it("creates an itinerary ending at the selected ship", () => {
    const { result } = renderHook(() => usePortAdminEditor(config));
    act(() => {
      result.current.setRouteLabel("Embarquement Ajaccio");
      result.current.setShipPointId("ship");
      result.current.setRoutePointIds(["control"]);
    });
    act(() => {
      result.current.addRoute();
    });

    const route = result.current.draft.routes[0];
    expect(route?.geometry.at(-1)).toEqual(shipCoordinates);
    expect(route?.pointIds).toEqual(["control", "ship"]);
    expect(route?.shipPointId).toBe("ship");
  });

  it("rejects a route with fewer than two traced coordinates", () => {
    const { result } = renderHook(() => usePortAdminEditor(config));
    act(() => {
      result.current.setRouteLabel("Route invalide");
      result.current.setShipPointId("ship");
    });
    act(() => {
      result.current.addRoute();
    });
    expect(result.current.draft.routes).toHaveLength(0);
  });

  it("recalculates route geometry when a point is dragged", () => {
    const seededConfig: PortMapConfig = {
      ...config,
      routes: [
        {
          geometry: [[43.3, 5.36], shipCoordinates],
          id: "route",
          label: "Embarquement",
          pointIds: ["control", "ship"],
          shipPointId: "ship"
        }
      ]
    };
    const { result } = renderHook(() => usePortAdminEditor(seededConfig));
    act(() => {
      result.current.movePoint("control", [43.32, 5.38]);
    });
    expect(result.current.draft.routes[0]?.geometry).toEqual([[43.32, 5.38], shipCoordinates]);
  });

  it("clears the editable draft when the administrator resets the map", () => {
    const { result } = renderHook(() => usePortAdminEditor(config));
    act(() => {
      result.current.resetDraft();
    });
    expect(result.current.draft).toEqual({ points: [], routes: [], version: 3 });
    expect(result.current.mode).toBe("point");
  });

  it("removes routes that become invalid when one of their points is deleted", () => {
    const seededConfig: PortMapConfig = {
      ...config,
      routes: [
        {
          geometry: [[43.3, 5.36], shipCoordinates],
          id: "route",
          label: "Embarquement",
          pointIds: ["control", "ship"],
          shipPointId: "ship"
        }
      ]
    };
    const { result } = renderHook(() => usePortAdminEditor(seededConfig));
    act(() => {
      result.current.deletePoint("control");
    });
    expect(result.current.draft.routes).toEqual([]);
    expect(result.current.isDirty).toBe(true);
  });
});
