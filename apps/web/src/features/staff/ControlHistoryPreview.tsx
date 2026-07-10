"use client";

import { useEffect, useState } from "react";
import { type ControlRecord } from "@corsica/contracts";

import { apiClient } from "../../lib/api-client";
import { AccountRow } from "../account/AccountRow";
import { ControlHistoryItem } from "./ControlHistoryItem";

const previewCount = 3;

export function ControlHistoryPreview() {
  const [controls, setControls] = useState<ControlRecord[] | null>(null);

  useEffect(() => {
    let active = true;
    void apiClient
      .getControlHistory()
      .then((records) => {
        if (active) setControls(records);
      })
      .catch(() => {
        if (active) setControls([]);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!controls) return <p className="text-sm text-muted">Chargement de l’historique…</p>;
  return (
    <>
      {controls.slice(0, previewCount).map((control) => (
        <ControlHistoryItem control={control} key={control.id} />
      ))}
      <AccountRow
        href="/salarie/historique"
        subtitle={`${String(controls.length)} contrôles enregistrés`}
        title="Voir tout l’historique"
      />
    </>
  );
}
