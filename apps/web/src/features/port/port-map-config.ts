import {
  portMapConfigSchema,
  type Coordinates,
  type PortMapConfig,
  type PortPoint,
  type PortPointType
} from "@corsica/contracts";

export type { PortMapConfig, PortPoint, PortPointType, PortRoute } from "@corsica/contracts";

export const portPointLabels: Record<PortPointType, string> = {
  boarding: "Embarquement",
  control: "Contrôle",
  ship: "Navire",
  storage: "Zone d’attente"
};

export const defaultPortMapConfig: PortMapConfig = {
  points: [],
  routes: [],
  version: 3
};

export const portMapStorageKey = "corsica.port-map-config.v3";

export function routeGeometryFromPoints(
  points: readonly PortPoint[],
  pointIds: readonly string[],
  shipPointId: string
): Coordinates[] {
  const pointsById = new Map(points.map((point) => [point.id, point]));
  const orderedIds = [...pointIds.filter((id) => id !== shipPointId), shipPointId];
  return orderedIds.flatMap((id) => {
    const point = pointsById.get(id);
    return point ? [point.coordinates] : [];
  });
}

export function readPortMapConfig(value: string | null): PortMapConfig {
  if (!value) return defaultPortMapConfig;

  try {
    const candidate: unknown = JSON.parse(value);
    const parsed = portMapConfigSchema.safeParse(candidate);
    return parsed.success ? parsed.data : defaultPortMapConfig;
  } catch {
    return defaultPortMapConfig;
  }
}
