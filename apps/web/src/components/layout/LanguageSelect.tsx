"use client";

import { useState } from "react";

import { Button } from "../ds/Button";
import { DropdownMenu } from "../ds/DropdownMenu";

const languages = [
  { code: "FR", label: "Français" },
  { code: "EN", label: "English" },
  { code: "IT", label: "Italiano" }
] as const;

export function LanguageSelect() {
  const [current, setCurrent] = useState("FR");

  return (
    <DropdownMenu
      ariaLabel="Choisir la langue"
      items={languages.map((language) => ({
        active: language.code === current,
        key: language.code,
        label: language.label,
        onSelect: () => {
          setCurrent(language.code);
        }
      }))}
      trigger={
        <Button aria-label={`Langue : ${current}`} size="icon" variant="outline">
          <span className="text-[12px] font-bold">{current}</span>
        </Button>
      }
    />
  );
}
