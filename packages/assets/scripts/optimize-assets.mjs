import { mkdir, readdir, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const brandSourceDir = path.join(packageRoot, "brand", "source");
const brandWebDir = path.join(packageRoot, "brand", "web");
const identitySourceDir = path.join(packageRoot, "identity", "source");
const identityWebDir = path.join(packageRoot, "identity", "web");

await mkdir(brandWebDir, { recursive: true });
await mkdir(identityWebDir, { recursive: true });

const existingBrandWebAssets = await readdir(brandWebDir, { withFileTypes: true });
const existingIdentityWebAssets = await readdir(identityWebDir, { withFileTypes: true });

await Promise.all(
  existingBrandWebAssets
    .filter((entry) => entry.isFile() && entry.name.endsWith(".webp"))
    .map((entry) => unlink(path.join(brandWebDir, entry.name)))
);

await Promise.all(
  existingIdentityWebAssets
    .filter((entry) => entry.isFile() && entry.name.endsWith(".webp"))
    .map((entry) => unlink(path.join(identityWebDir, entry.name)))
);

const backgroundSource = path.join(brandSourceDir, "auth-background.webp");
const desktopBackgroundSource = path.join(brandSourceDir, "auth-background-desktop.webp");
const googleIconSource = path.join(identitySourceDir, "google-g-icon.svg");
const logoSources = [
  ["corsica-symbol-red", "corsica-symbol-red.webp", 768],
  ["corsica-symbol-white", "corsica-symbol-white.webp", 768],
  ["corsica-wordmark-red", "corsica-wordmark-red.webp", 1600],
  ["corsica-lockup-red", "corsica-lockup-red.webp", 1800]
];

const backgroundVariants = [
  ["auth-background-540.webp", 540],
  ["auth-background-720.webp", 720],
  ["auth-background-1080.webp", 1080]
];

const desktopBackgroundVariants = [
  ["auth-background-desktop-1280.webp", 1280],
  ["auth-background-desktop-1920.webp", 1920],
  ["auth-background-desktop-2560.webp", 2560]
];

await Promise.all(
  backgroundVariants.map(([fileName, width]) =>
    sharp(backgroundSource)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ effort: 6, quality: 82 })
      .toFile(path.join(brandWebDir, fileName))
  )
);

await Promise.all(
  desktopBackgroundVariants.map(([fileName, width]) =>
    sharp(desktopBackgroundSource)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ effort: 6, quality: 84 })
      .toFile(path.join(brandWebDir, fileName))
  )
);

await Promise.all(
  logoSources.map(([assetName, fileName, width]) =>
    sharp(path.join(brandSourceDir, fileName))
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ effort: 6, lossless: true })
      .toFile(path.join(brandWebDir, `${assetName}.webp`))
  )
);

await sharp(googleIconSource)
  .resize({ width: 80 })
  .webp({ effort: 6, lossless: true })
  .toFile(path.join(identityWebDir, "google-g-icon.webp"));
