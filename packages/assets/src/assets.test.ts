import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { brandAssets } from "./brand";
import { identityAssets } from "./identity";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("brand assets", () => {
  for (const [assetName, asset] of Object.entries(brandAssets)) {
    it(`matches the generated ${assetName} file`, async () => {
      const assetPath = path.join(packageRoot, asset.source);

      expect(existsSync(assetPath)).toBe(true);
      expect(asset.alt).not.toHaveLength(0);
      expect(asset.type).toBe("image/webp");

      const metadata = await sharp(assetPath).metadata();

      expect(metadata.format).toBe("webp");
      expect(metadata.width).toBe(asset.width);
      expect(metadata.height).toBe(asset.height);
    });
  }
});

describe("identity assets", () => {
  for (const [assetName, asset] of Object.entries(identityAssets)) {
    it(`matches the generated ${assetName} file`, async () => {
      const assetPath = path.join(packageRoot, asset.source);

      expect(existsSync(assetPath)).toBe(true);
      expect(asset.alt).not.toHaveLength(0);
      expect(asset.type).toBe("image/webp");

      const metadata = await sharp(assetPath).metadata();

      expect(metadata.format).toBe("webp");
      expect(metadata.width).toBe(asset.width);
      expect(metadata.height).toBe(asset.height);
    });
  }
});
