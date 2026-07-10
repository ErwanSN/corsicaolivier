"use client";

import { MapPinPlus, RotateCcw, Route, Save, ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "../../components/ds/Button";
import { Modal } from "../../components/ds/Modal";
import { PointForm, RouteForm } from "./PortAdminForms";
import { PointList, RouteList } from "./PortAdminLists";
import { type PortMapConfig, type PortRoute, routeGeometryFromPoints } from "./port-map-config";
import { PortMap } from "./PortMap";
import { usePortAdminEditor } from "./use-port-admin-editor";

type EditorProps = Readonly<{
  config: PortMapConfig;
  error: string | null;
  onClose: () => void;
  onSave: (config: PortMapConfig) => Promise<boolean>;
}>;

export function PortAdminEditor({ config, error, onClose, onSave }: EditorProps) {
  const editor = usePortAdminEditor(config);
  const [confirmation, setConfirmation] = useState<"close" | "reset" | null>(null);
  useDraftProtection(editor.isDirty);
  const previewGeometry = routeGeometryFromPoints(
    editor.draft.points,
    editor.routePointIds,
    editor.shipPointId
  );
  const previewRoute: PortRoute | undefined =
    previewGeometry.length >= 2
      ? {
          geometry: previewGeometry,
          id: "route-preview",
          label: editor.routeLabel || "Aperçu",
          pointIds: [...editor.routePointIds],
          shipPointId: editor.shipPointId
        }
      : undefined;
  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 pb-28 lg:grid-cols-[minmax(340px,0.8fr)_minmax(0,1.5fr)] lg:px-8">
      <aside className="min-w-0 space-y-5 lg:max-h-[calc(100svh-11rem)] lg:overflow-y-auto lg:pr-2">
        <EditorHeader
          onClose={() => {
            if (editor.isDirty) setConfirmation("close");
            else onClose();
          }}
        />
        {error ? (
          <p
            className="rounded-xl bg-brand/5 px-3 py-2 text-[13px] font-medium text-brand"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <EditorMode mode={editor.mode} onChange={editor.setMode} />
        {editor.mode === "point" ? (
          <PointForm
            label={editor.pointLabel}
            onLabelChange={editor.setPointLabel}
            onTypeChange={editor.setPointType}
            type={editor.pointType}
          />
        ) : (
          <RouteForm
            config={editor.draft}
            label={editor.routeLabel}
            onCreate={editor.addRoute}
            onLabelChange={editor.setRouteLabel}
            onSelectionChange={editor.setRoutePointIds}
            onShipChange={editor.setShipPointId}
            selectedPointIds={editor.routePointIds}
            shipPointId={editor.shipPointId}
          />
        )}
        <PointList config={editor.draft} onDelete={editor.deletePoint} onMove={editor.movePoint} />
        <RouteList config={editor.draft} onDelete={editor.deleteRoute} />
        <EditorActions
          draft={editor.draft}
          isDirty={editor.isDirty}
          onReset={() => {
            setConfirmation("reset");
          }}
          onSave={onSave}
        />
      </aside>
      <section
        aria-label="Carte d’édition du port"
        className="min-w-0 lg:sticky lg:top-28 lg:self-start"
      >
        <PortMap
          {...(editor.mode === "point" ? { onMapClick: editor.addPoint } : {})}
          onPointMove={editor.movePoint}
          points={editor.draft.points}
          routes={editor.draft.routes}
          {...(previewRoute ? { route: previewRoute } : {})}
        />
      </section>
      {confirmation ? (
        <EditorConfirmation
          action={confirmation}
          onCancel={() => {
            setConfirmation(null);
          }}
          onConfirm={() => {
            setConfirmation(null);
            if (confirmation === "close") onClose();
            else editor.resetDraft();
          }}
        />
      ) : null}
    </div>
  );
}

function useDraftProtection(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) return;
    const protectDraft = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", protectDraft);
    return () => {
      window.removeEventListener("beforeunload", protectDraft);
    };
  }, [isDirty]);
}

function EditorHeader({ onClose }: Readonly<{ onClose: () => void }>) {
  return (
    <header>
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[13px] font-bold text-brand uppercase">
          <ShieldCheck className="size-4" /> Mode administrateur
        </p>
        <Button aria-label="Fermer l’éditeur" onClick={onClose} size="icon" variant="ghost">
          <X className="size-5" />
        </Button>
      </div>
      <h1 className="mt-2 text-3xl font-bold">Configurer le guidage</h1>
      <p className="mt-2 text-[13px] leading-5 text-muted">
        Placez les repères utiles, puis construisez les itinéraires menant à chaque navire.
      </p>
    </header>
  );
}

function EditorMode({
  mode,
  onChange
}: Readonly<{ mode: "point" | "route"; onChange: (mode: "point" | "route") => void }>) {
  return (
    <div
      aria-label="Outil d’édition"
      className="grid grid-cols-2 gap-1 rounded-2xl bg-foreground/5 p-1"
      role="group"
    >
      <Button
        aria-pressed={mode === "point"}
        className={mode === "point" ? "bg-surface shadow-sm" : undefined}
        onClick={() => {
          onChange("point");
        }}
        variant="ghost"
      >
        <MapPinPlus className="size-4" /> Points
      </Button>
      <Button
        aria-pressed={mode === "route"}
        className={mode === "route" ? "bg-surface shadow-sm" : undefined}
        onClick={() => {
          onChange("route");
        }}
        variant="ghost"
      >
        <Route className="size-4" /> Itinéraires
      </Button>
    </div>
  );
}

function EditorActions({
  draft,
  isDirty,
  onReset,
  onSave
}: Readonly<{
  draft: PortMapConfig;
  isDirty: boolean;
  onReset: () => void;
  onSave: (config: PortMapConfig) => Promise<boolean>;
}>) {
  const [saving, setSaving] = useState(false);
  async function save(): Promise<void> {
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="flex flex-wrap gap-2 border-t border-border pt-5">
      <Button
        disabled={saving || !isDirty}
        onClick={() => {
          void save();
        }}
        variant="brand"
      >
        <Save className="size-4" />
        {saving ? "Enregistrement…" : "Enregistrer"}
      </Button>
      <Button disabled={saving || !isDirty} onClick={onReset} variant="outline">
        <RotateCcw className="size-4" />
        Réinitialiser le brouillon
      </Button>
    </div>
  );
}

function EditorConfirmation({
  action,
  onCancel,
  onConfirm
}: Readonly<{
  action: "close" | "reset";
  onCancel: () => void;
  onConfirm: () => void;
}>) {
  const closesEditor = action === "close";
  return (
    <Modal
      onClose={onCancel}
      size="small"
      title={closesEditor ? "Abandonner les modifications ?" : "Réinitialiser le brouillon ?"}
    >
      <p className="text-[14px] leading-6 text-muted">
        {closesEditor
          ? "Les changements non enregistrés seront perdus."
          : "Tous les points et itinéraires du brouillon seront retirés. La carte publiée ne changera qu’après enregistrement."}
      </p>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button onClick={onCancel} variant="outline">
          Annuler
        </Button>
        <Button onClick={onConfirm} variant="brand">
          {closesEditor ? "Abandonner" : "Réinitialiser"}
        </Button>
      </div>
    </Modal>
  );
}
