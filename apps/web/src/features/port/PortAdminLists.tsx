import { Route, Trash2 } from "lucide-react";

import { type Coordinates } from "./port-guide";
import { type PortMapConfig, portPointLabels } from "./port-map-config";

type ListProps = Readonly<{ config: PortMapConfig; onDelete: (id: string) => void }>;
type PointListProps = ListProps &
  Readonly<{ onMove: (id: string, coordinates: Coordinates) => void }>;

function DeleteButton({
  id,
  label,
  onDelete
}: Readonly<{ id: string; label: string; onDelete: (id: string) => void }>) {
  return (
    <button
      aria-label={`Supprimer ${label}`}
      className="focus-ring rounded-full p-2 text-brand"
      onClick={() => {
        onDelete(id);
      }}
      type="button"
    >
      <Trash2 className="size-4" />
    </button>
  );
}

export function PointList({ config, onDelete, onMove }: PointListProps) {
  return (
    <section aria-labelledby="poi-list-title">
      <h2 className="text-[14px] font-bold" id="poi-list-title">
        Points visibles ({config.points.length})
      </h2>
      {config.points.length === 0 ? (
        <p className="mt-2 text-[12px] text-muted">Aucun point placé.</p>
      ) : null}
      <ul className="mt-2 space-y-2">
        {config.points.map((point) => (
          <li className="rounded-xl bg-foreground/5 px-3 py-2" key={point.id}>
            <div className="flex min-h-9 items-center gap-3">
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{point.label}</span>
              <span className="text-[11px] text-muted">{portPointLabels[point.type]}</span>
              <DeleteButton id={point.id} label={point.label} onDelete={onDelete} />
            </div>
            <CoordinateFields
              coordinates={point.coordinates}
              label={point.label}
              onChange={(coordinates) => {
                onMove(point.id, coordinates);
              }}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function CoordinateFields({
  coordinates,
  label,
  onChange
}: Readonly<{
  coordinates: Coordinates;
  label: string;
  onChange: (coordinates: Coordinates) => void;
}>) {
  function update(index: 0 | 1, value: string): void {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) return;
    const next: Coordinates = [...coordinates];
    next[index] = parsed;
    onChange(next);
  }
  return (
    <div className="grid grid-cols-2 gap-2 pb-1">
      {(["Latitude", "Longitude"] as const).map((name, index) => (
        <label className="grid gap-1 text-[10px] font-semibold text-muted" key={name}>
          {name} de {label}
          <input
            className="focus-ring h-9 min-w-0 rounded-lg border border-border bg-surface px-2 text-[12px] text-foreground"
            inputMode="decimal"
            onChange={(event) => {
              update(index as 0 | 1, event.target.value);
            }}
            step="0.00001"
            type="number"
            value={coordinates[index]}
          />
        </label>
      ))}
    </div>
  );
}

export function RouteList({ config, onDelete }: ListProps) {
  if (config.routes.length === 0) return null;
  return (
    <section aria-labelledby="route-list-title">
      <h2 className="text-[14px] font-bold" id="route-list-title">
        Itinéraires enregistrés ({config.routes.length})
      </h2>
      <ul className="mt-2 space-y-2">
        {config.routes.map((route) => (
          <li
            className="flex min-h-11 items-center gap-3 rounded-xl bg-foreground/5 px-3"
            key={route.id}
          >
            <Route className="size-4 text-brand" />
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{route.label}</span>
            <DeleteButton id={route.id} label={route.label} onDelete={onDelete} />
          </li>
        ))}
      </ul>
    </section>
  );
}
