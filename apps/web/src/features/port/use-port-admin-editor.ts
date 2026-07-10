"use client";

import { useMemo, useState } from "react";

import { type Coordinates } from "./port-guide";
import {
  defaultPortMapConfig,
  type PortMapConfig,
  type PortPointType,
  routeGeometryFromPoints
} from "./port-map-config";

export function usePortAdminEditor(config: PortMapConfig) {
  const [mode, setMode] = useState<"point" | "route">("point");
  const [draft, setDraft] = useState(config);
  const [pointLabel, setPointLabel] = useState("");
  const [pointType, setPointType] = useState<PortPointType>("control");
  const [routeLabel, setRouteLabel] = useState("");
  const [routePointIds, setRoutePointIds] = useState<readonly string[]>([]);
  const [shipPointId, setShipPointId] = useState("");
  const isDirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(config), [config, draft]);
  function addPoint(coordinates: Coordinates): void {
    const label = pointLabel.trim();
    if (!label) return;
    setDraft((current) => ({
      ...current,
      points: [...current.points, { coordinates, id: crypto.randomUUID(), label, type: pointType }]
    }));
    setPointLabel("");
  }
  function deletePoint(pointId: string): void {
    setDraft((current) => deletePointFromConfig(current, pointId));
    setRoutePointIds((current) => current.filter((id) => id !== pointId));
  }
  function addRoute(): void {
    const label = routeLabel.trim();
    const ship = draft.points.find(({ id, type }) => id === shipPointId && type === "ship");
    const geometry = routeGeometryFromPoints(draft.points, routePointIds, shipPointId);
    if (!label || !ship || geometry.length < 2) return;
    setDraft((current) => ({
      ...current,
      routes: [
        ...current.routes,
        {
          geometry,
          id: crypto.randomUUID(),
          label,
          pointIds: [...new Set([...routePointIds, ship.id])],
          shipPointId: ship.id
        }
      ]
    }));
    setRouteLabel("");
    setRoutePointIds([]);
    setShipPointId("");
    setMode("point");
  }
  function movePoint(pointId: string, coordinates: Coordinates): void {
    setDraft((current) => {
      const points = current.points.map((point) =>
        point.id === pointId ? { ...point, coordinates } : point
      );
      return {
        ...current,
        points,
        routes: current.routes.map((route) => ({
          ...route,
          geometry: routeGeometryFromPoints(points, route.pointIds, route.shipPointId)
        }))
      };
    });
  }
  function deleteRoute(routeId: string): void {
    setDraft((current) => ({
      ...current,
      routes: current.routes.filter(({ id }) => id !== routeId)
    }));
  }
  function resetDraft(): void {
    setDraft(defaultPortMapConfig);
    setMode("point");
    setPointLabel("");
    setRouteLabel("");
    setRoutePointIds([]);
    setShipPointId("");
  }
  return {
    addPoint,
    addRoute,
    deletePoint,
    deleteRoute,
    draft,
    isDirty,
    mode,
    movePoint,
    pointLabel,
    pointType,
    resetDraft,
    routeLabel,
    routePointIds,
    setMode,
    setPointLabel,
    setPointType,
    setRouteLabel,
    setRoutePointIds,
    setShipPointId,
    shipPointId
  } as const;
}

function deletePointFromConfig(config: PortMapConfig, pointId: string): PortMapConfig {
  const points = config.points.filter(({ id }) => id !== pointId);
  const routes = config.routes.flatMap((route) => {
    const pointIds = route.pointIds.filter((id) => id !== pointId);
    if (route.shipPointId === pointId || pointIds.length < 2) return [];
    return [
      {
        ...route,
        geometry: routeGeometryFromPoints(points, pointIds, route.shipPointId),
        pointIds
      }
    ];
  });
  return { ...config, points, routes };
}
