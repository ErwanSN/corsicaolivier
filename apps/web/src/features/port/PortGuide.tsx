"use client";

import { Settings } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";

import { useStoredAuthSession } from "../auth/use-stored-auth-session";
import { type PortMapConfig, type PortPoint, type PortRoute } from "./port-map-config";
import { usePortMapConfig } from "./use-port-map-config";

const PortMap = dynamic(() => import("./PortMap").then((module) => module.PortMap), {
  loading: () => (
    <div className="flex min-h-[calc(100svh-10rem)] items-center justify-center bg-[#eef0f2] text-[14px] text-muted">
      Chargement de la carte du port…
    </div>
  ),
  ssr: false
});

export function PortGuide() {
  const { session } = useStoredAuthSession();
  const { config, error, reload, status } = usePortMapConfig();
  const [routeId, setRouteId] = useState("");
  const isAdmin = session?.user.role === "ADMIN";
  const route = config.routes.find(({ id }) => id === routeId) ?? config.routes[0];
  const visiblePoints = pointsForRoute(config, route);

  if (status === "loading") {
    return (
      <div
        className="grid min-h-[calc(100svh-10rem)] place-items-center bg-[#eef0f2] text-[14px] text-muted"
        role="status"
      >
        Chargement de la carte du port…
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="grid min-h-[calc(100svh-10rem)] place-items-center px-4 text-center">
        <div>
          <p className="font-semibold">Carte temporairement indisponible</p>
          <p className="mt-2 text-[13px] text-muted">{error}</p>
          <button
            className="focus-ring mt-4 h-11 rounded-full bg-surface-inverse px-5 text-[14px] font-semibold text-background"
            onClick={() => {
              void reload();
            }}
            type="button"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="relative min-h-[calc(100svh-10rem)] pb-20 lg:pb-0">
      <PortMap points={visiblePoints} {...(route ? { route } : {})} />
      <FloatingControls
        isAdmin={isAdmin}
        onRouteChange={setRouteId}
        route={route}
        routes={config.routes}
      />
    </div>
  );
}

function pointsForRoute(config: PortMapConfig, route: PortRoute | undefined): readonly PortPoint[] {
  if (!route) return config.points;
  const visiblePointIds = new Set(route.pointIds);
  return config.points.filter(({ id }) => visiblePointIds.has(id));
}

function FloatingControls({
  isAdmin,
  onRouteChange,
  route,
  routes
}: Readonly<{
  isAdmin: boolean;
  onRouteChange: (id: string) => void;
  route: PortRoute | undefined;
  routes: readonly PortRoute[];
}>) {
  if (routes.length === 0 && !isAdmin) return null;
  return (
    <div className="absolute left-3 top-3 z-[500] flex items-center gap-2">
      {routes.length > 0 ? (
        <select
          aria-label="Parcours affiché"
          className="focus-ring h-11 rounded-full border border-border bg-surface px-4 text-[14px] font-semibold shadow-lg"
          onChange={(event) => {
            onRouteChange(event.target.value);
          }}
          value={route?.id ?? ""}
        >
          {routes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      ) : null}
      {isAdmin ? (
        <Link
          className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full bg-surface-inverse px-5 text-[14px] font-semibold text-background"
          href="/port/admin"
        >
          <Settings className="size-4" />
          Modifier la carte
        </Link>
      ) : null}
    </div>
  );
}
