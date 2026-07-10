import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { colors, spacing } from "./tokens";

function relativeLuminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    ?.map((value) => Number.parseInt(value, 16) / 255);
  if (channels?.length !== 3) throw new Error(`Invalid color: ${hex}`);
  const [red = 0, green = 0, blue = 0] = channels.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  );
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function contrastRatio(foreground: string, background: string): number {
  const values = [relativeLuminance(foreground), relativeLuminance(background)].sort(
    (left, right) => right - left
  );
  return ((values[0] ?? 0) + 0.05) / ((values[1] ?? 0) + 0.05);
}

describe("design tokens", () => {
  it("keeps all text colors WCAG AA compliant on the default background", () => {
    expect(contrastRatio(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.muted, colors.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.brand, colors.background)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps CSS color variables aligned with TypeScript tokens", () => {
    const css = readFileSync("src/tokens.css", "utf8").toLowerCase();
    for (const [name, value] of Object.entries(colors)) {
      expect(css).toContain(
        `--color-${name.replaceAll(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}: ${value.toLowerCase()}`
      );
    }
  });

  it("uses a monotonic spacing scale", () => {
    const values = Object.values(spacing);
    expect(values.every((value, index) => index === 0 || value > (values[index - 1] ?? 0))).toBe(
      true
    );
  });
});
