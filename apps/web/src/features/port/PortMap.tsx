"use client";

import {
  divIcon,
  type DivIcon,
  type LeafletEvent,
  type LeafletEventHandlerFnMap,
  type Marker as LeafletMarker
} from "leaflet";
import { LocateFixed } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
  useMapEvents
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { Button } from "../../components/ds/Button";
import { type Coordinates, marseillePortCenter } from "./port-guide";
import { type PortPoint, type PortRoute, portPointLabels } from "./port-map-config";

const userIcon = divIcon({
  className: "port-map-user-marker",
  html: "",
  iconAnchor: [11, 11],
  iconSize: [22, 22]
});

function pointIcon(point: PortPoint) {
  const labels = { boarding: "E", control: "C", ship: "N", storage: "A" } as const;
  return divIcon({
    className: `port-poi-marker port-poi-marker--${point.type}`,
    html: `<span>${labels[point.type]}</span>`,
    iconAnchor: [18, 18],
    iconSize: [36, 36]
  });
}

function markerDragHandlers(
  pointId: string,
  onPointMove: (pointId: string, coordinates: Coordinates) => void
): LeafletEventHandlerFnMap {
  function handleMove(event: LeafletEvent): void {
    const marker = event.target as LeafletMarker;
    const { lat, lng } = marker.getLatLng();
    onPointMove(pointId, [lat, lng]);
  }
  return { drag: handleMove, dragend: handleMove };
}

function MapViewport({
  points,
  route,
  routes,
  userPosition
}: Readonly<{
  points: readonly PortPoint[];
  route?: PortRoute;
  routes: readonly PortRoute[];
  userPosition: Coordinates | null;
}>) {
  const map = useMap();
  useEffect(() => {
    const positions = [
      ...points.map(({ coordinates }) => coordinates),
      ...routes.flatMap(({ geometry }) => geometry),
      ...(route?.geometry ?? [])
    ];
    if (userPosition) positions.push(userPosition);
    if (positions.length > 0) map.fitBounds(positions, { maxZoom: 17, padding: [54, 54] });
  }, [map, points, route, routes, userPosition]);
  return null;
}

function MapClickHandler({
  onMapClick
}: Readonly<{ onMapClick?: (coordinates: Coordinates) => void }>) {
  useMapEvents({ click: ({ latlng }) => onMapClick?.([latlng.lat, latlng.lng]) });
  return null;
}

function MapAttributionPolicy() {
  const map = useMap();
  useEffect(() => {
    map.attributionControl.setPrefix(false);
  }, [map]);
  return null;
}

type MapLayersProps = Readonly<{
  icons: ReadonlyMap<string, DivIcon>;
  onMapClick?: (coordinates: Coordinates) => void;
  onPointMove?: (pointId: string, coordinates: Coordinates) => void;
  points: readonly PortPoint[];
  route?: PortRoute;
  routes: readonly PortRoute[];
  userPosition: Coordinates | null;
}>;

function MapLayers({
  icons,
  onMapClick,
  onPointMove,
  points,
  route,
  routes,
  userPosition
}: MapLayersProps) {
  return (
    <>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains="abcd"
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      {routes.map((item) => (
        <Polyline
          key={item.id}
          pathOptions={{ color: "#172554", opacity: 0.5, weight: 5 }}
          positions={[...item.geometry]}
        />
      ))}
      {route ? (
        <Polyline
          pathOptions={{ color: "#172554", opacity: 0.88, weight: 6 }}
          positions={[...route.geometry]}
        />
      ) : null}
      {points.map((point) => (
        <Marker
          alt={point.label}
          draggable={Boolean(onPointMove)}
          icon={icons.get(point.id)}
          key={point.id}
          position={point.coordinates}
          title={point.label}
          {...(onPointMove
            ? {
                eventHandlers: markerDragHandlers(point.id, onPointMove)
              }
            : {})}
        >
          <Popup>
            <strong>{point.label}</strong>
            <br />
            {portPointLabels[point.type]}
          </Popup>
        </Marker>
      ))}
      {userPosition ? (
        <Marker alt="Votre position" icon={userIcon} position={userPosition} title="Votre position">
          <Popup>Votre position</Popup>
        </Marker>
      ) : null}
      <MapViewport
        points={points}
        routes={routes}
        userPosition={userPosition}
        {...(route ? { route } : {})}
      />
      <MapClickHandler {...(onMapClick ? { onMapClick } : {})} />
    </>
  );
}

export type PortMapProps = Readonly<{
  onMapClick?: (coordinates: Coordinates) => void;
  onPointMove?: (pointId: string, coordinates: Coordinates) => void;
  points: readonly PortPoint[];
  route?: PortRoute;
  routes?: readonly PortRoute[];
}>;

export function PortMap({ onMapClick, onPointMove, points, route, routes = [] }: PortMapProps) {
  const [locationError, setLocationError] = useState<string | null>(null);
  const [userPosition, setUserPosition] = useState<Coordinates | null>(null);
  const icons = useMemo(
    () => new Map(points.map((point) => [point.id, pointIcon(point)])),
    [points]
  );
  function locateUser(): void {
    setLocationError(null);
    if (!("geolocation" in navigator)) {
      setLocationError("La localisation n’est pas disponible sur cet appareil.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setUserPosition([coords.latitude, coords.longitude]);
      },
      () => {
        setLocationError("Position indisponible. Vérifiez l’autorisation de localisation.");
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 10_000 }
    );
  }
  return (
    <div className="relative h-[calc(100svh-10rem)] min-h-[500px] overflow-hidden bg-[#eef0f2] lg:h-[calc(100svh-7.5rem)]">
      <MapContainer
        center={marseillePortCenter}
        className={`h-full w-full ${onMapClick || onPointMove ? "cursor-crosshair" : ""}`}
        scrollWheelZoom
        zoom={14}
        zoomControl={false}
      >
        <MapAttributionPolicy />
        <MapLayers
          icons={icons}
          points={points}
          routes={routes}
          userPosition={userPosition}
          {...(onMapClick ? { onMapClick } : {})}
          {...(onPointMove ? { onPointMove } : {})}
          {...(route ? { route } : {})}
        />
      </MapContainer>
      {!onPointMove ? <LocationControl error={locationError} onLocate={locateUser} /> : null}
    </div>
  );
}

function LocationControl({
  error,
  onLocate
}: Readonly<{ error: string | null; onLocate: () => void }>) {
  return (
    <div className="absolute right-3 top-3 z-[500] flex flex-col items-end gap-2">
      <Button aria-label="Afficher ma position" onClick={onLocate} size="icon" variant="outline">
        <LocateFixed className="size-5" />
      </Button>
      {error ? (
        <p className="max-w-64 bg-surface px-3 py-2 text-[12px] font-medium shadow-lg" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
