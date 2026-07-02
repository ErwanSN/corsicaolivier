export type BrandAsset = Readonly<{
  alt: string;
  height: number;
  source: string;
  type: "image/webp";
  width: number;
}>;

export const brandAssets = {
  authBackground: {
    alt: "Corsica Linea ferry at sea",
    height: 2348,
    source: "brand/web/auth-background-1080.webp",
    type: "image/webp",
    width: 1080
  },
  authBackground540: {
    alt: "Corsica Linea ferry at sea",
    height: 1174,
    source: "brand/web/auth-background-540.webp",
    type: "image/webp",
    width: 540
  },
  authBackground720: {
    alt: "Corsica Linea ferry at sea",
    height: 1565,
    source: "brand/web/auth-background-720.webp",
    type: "image/webp",
    width: 720
  },
  authBackgroundDesktop: {
    alt: "Corsica Linea ferries at sea",
    height: 1093,
    source: "brand/web/auth-background-desktop-2560.webp",
    type: "image/webp",
    width: 2560
  },
  authBackgroundDesktop1280: {
    alt: "Corsica Linea ferries at sea",
    height: 547,
    source: "brand/web/auth-background-desktop-1280.webp",
    type: "image/webp",
    width: 1280
  },
  authBackgroundDesktop1920: {
    alt: "Corsica Linea ferries at sea",
    height: 820,
    source: "brand/web/auth-background-desktop-1920.webp",
    type: "image/webp",
    width: 1920
  },
  logoLockupRed: {
    alt: "Corsica Linea",
    height: 505,
    source: "brand/web/corsica-lockup-red.webp",
    type: "image/webp",
    width: 1800
  },
  logoSymbolRed: {
    alt: "Corsica Linea emblem",
    height: 877,
    source: "brand/web/corsica-symbol-red.webp",
    type: "image/webp",
    width: 768
  },
  logoSymbolWhite: {
    alt: "Corsica Linea emblem",
    height: 851,
    source: "brand/web/corsica-symbol-white.webp",
    type: "image/webp",
    width: 768
  },
  logoWordmarkRed: {
    alt: "Corsica Linea",
    height: 619,
    source: "brand/web/corsica-wordmark-red.webp",
    type: "image/webp",
    width: 1600
  }
} as const satisfies Record<string, BrandAsset>;
