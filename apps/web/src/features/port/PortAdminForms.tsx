import { MapPinPlus, Navigation } from "lucide-react";

import { Button } from "../../components/ds/Button";
import { Select, type SelectOption } from "../../components/ds/Select";
import { type PortMapConfig, type PortPointType, portPointLabels } from "./port-map-config";

const pointTypeOptions: readonly SelectOption[] = Object.entries(portPointLabels).map(
  ([value, label]) => ({ label, value })
);

export function PointForm({
  label,
  onLabelChange,
  onTypeChange,
  type
}: Readonly<{
  label: string;
  onLabelChange: (value: string) => void;
  onTypeChange: (value: PortPointType) => void;
  type: PortPointType;
}>) {
  return (
    <fieldset className="rounded-2xl border border-border p-4">
      <legend className="px-1 text-[14px] font-bold">Nouveau point d’intérêt</legend>
      <label className="mt-2 block text-[12px] font-semibold">
        Nom
        <input
          className="focus-ring mt-2 h-11 w-full rounded-xl border border-border px-3 text-[14px]"
          onChange={(event) => {
            onLabelChange(event.target.value);
          }}
          placeholder="Ex. Contrôle billets"
          value={label}
        />
      </label>
      <div className="mt-3 grid gap-2 text-[12px] font-semibold">
        Type
        <Select
          ariaLabel="Type de point d’intérêt"
          className="w-full rounded-xl border border-border bg-surface"
          onValueChange={(value) => {
            onTypeChange(value as PortPointType);
          }}
          options={pointTypeOptions}
          placeholder="Choisir un type"
          value={type}
        />
      </div>
      <p className="mt-3 flex items-center gap-2 text-[12px] text-muted">
        <MapPinPlus className="size-4" /> Saisissez un nom, puis cliquez sur la carte.
      </p>
    </fieldset>
  );
}

type RouteFormProps = Readonly<{
  config: PortMapConfig;
  label: string;
  onLabelChange: (value: string) => void;
  onCreate: () => void;
  onSelectionChange: (ids: readonly string[]) => void;
  onShipChange: (id: string) => void;
  selectedPointIds: readonly string[];
  shipPointId: string;
}>;

export function RouteForm(props: RouteFormProps) {
  const shipOptions = props.config.points
    .filter(({ type }) => type === "ship")
    .map(({ id: value, label }) => ({ label, value }));
  const ready = Boolean(props.label.trim() && props.shipPointId && props.selectedPointIds.length);
  return (
    <fieldset className="rounded-2xl border border-border p-4">
      <legend className="px-1 text-[14px] font-bold">Nouvel itinéraire</legend>
      <input
        aria-label="Nom de l’itinéraire"
        className="focus-ring mt-2 h-11 w-full rounded-xl border border-border px-3 text-[14px]"
        onChange={(event) => {
          props.onLabelChange(event.target.value);
        }}
        placeholder="Ex. Embarquement Ajaccio"
        value={props.label}
      />
      <div className="mt-3 grid gap-2 text-[12px] font-semibold">
        Navire de destination
        <Select
          ariaLabel="Navire de destination"
          className="w-full rounded-xl border border-border bg-surface"
          onValueChange={props.onShipChange}
          options={shipOptions}
          placeholder={
            shipOptions.length === 0 ? "Créez d’abord un point Navire" : "Sélectionner un navire"
          }
          value={props.shipPointId}
        />
      </div>
      <RoutePointSelection {...props} />
      <div
        className={`mt-4 flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12px] font-semibold ${ready ? "bg-success/10 text-success" : "bg-brand/5 text-brand"}`}
      >
        <Navigation className="size-4 shrink-0" />
        {ready
          ? "Aperçu actualisé en temps réel sur la carte."
          : "Renseignez un nom, une étape et un navire pour calculer l’itinéraire."}
      </div>
      <Button className="mt-4 w-full" disabled={!ready} onClick={props.onCreate} variant="brand">
        Créer l’itinéraire
      </Button>
    </fieldset>
  );
}

function RoutePointSelection({ config, onSelectionChange, selectedPointIds }: RouteFormProps) {
  const selectablePoints = config.points.filter(({ type }) => type !== "ship");
  if (selectablePoints.length === 0) return null;
  function toggle(id: string): void {
    onSelectionChange(
      selectedPointIds.includes(id)
        ? selectedPointIds.filter((value) => value !== id)
        : [...selectedPointIds, id]
    );
  }
  return (
    <div className="mt-4">
      <p className="text-[12px] font-semibold">Étapes visibles sur le parcours</p>
      <div className="mt-1 space-y-1">
        {selectablePoints.map((point) => (
          <label className="flex min-h-10 items-center gap-3 text-[13px]" key={point.id}>
            <input
              checked={selectedPointIds.includes(point.id)}
              onChange={() => {
                toggle(point.id);
              }}
              type="checkbox"
            />
            {selectedPointIds.includes(point.id) ? (
              <span className="grid size-5 place-items-center rounded-full bg-brand text-[11px] font-bold text-white">
                {selectedPointIds.indexOf(point.id) + 1}
              </span>
            ) : null}
            {point.label}
          </label>
        ))}
      </div>
    </div>
  );
}
