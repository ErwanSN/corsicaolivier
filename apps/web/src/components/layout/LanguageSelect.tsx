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
        <Button
          aria-label={`Langue : ${current}`}
          className="size-auto border-0 bg-transparent px-1"
          size="icon"
          variant="ghost"
        >
          <span className="text-[12px] font-bold">{current}</span>
          <span aria-hidden="true" className="text-[10px]">
            ⌄
          </span>
        </Button>
      }
    />
  );
}
