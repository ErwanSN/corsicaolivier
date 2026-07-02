import { brandAssets } from "@corsica/assets";
import { type StaticImageData } from "next/image";

import desktopBackground1280 from "../../../../packages/assets/brand/web/auth-background-desktop-1280.webp";
import desktopBackground1920 from "../../../../packages/assets/brand/web/auth-background-desktop-1920.webp";
import desktopBackground2560 from "../../../../packages/assets/brand/web/auth-background-desktop-2560.webp";
import mobileBackground540 from "../../../../packages/assets/brand/web/auth-background-540.webp";
import mobileBackground720 from "../../../../packages/assets/brand/web/auth-background-720.webp";
import mobileBackground1080 from "../../../../packages/assets/brand/web/auth-background-1080.webp";
import logoSymbolRed from "../../../../packages/assets/brand/web/corsica-symbol-red.webp";
import logoSymbolWhite from "../../../../packages/assets/brand/web/corsica-symbol-white.webp";

type WebBrandImage = Readonly<{
  alt: string;
  height: number;
  source: StaticImageData;
  width: number;
}>;

export const webBrandImages = {
  authBackgroundDesktop: {
    alt: brandAssets.authBackgroundDesktop.alt,
    height: brandAssets.authBackgroundDesktop.height,
    source: desktopBackground2560,
    width: brandAssets.authBackgroundDesktop.width
  },
  authBackgroundDesktop1280: {
    alt: brandAssets.authBackgroundDesktop1280.alt,
    height: brandAssets.authBackgroundDesktop1280.height,
    source: desktopBackground1280,
    width: brandAssets.authBackgroundDesktop1280.width
  },
  authBackgroundDesktop1920: {
    alt: brandAssets.authBackgroundDesktop1920.alt,
    height: brandAssets.authBackgroundDesktop1920.height,
    source: desktopBackground1920,
    width: brandAssets.authBackgroundDesktop1920.width
  },
  authBackgroundMobile: {
    alt: brandAssets.authBackground.alt,
    height: brandAssets.authBackground.height,
    source: mobileBackground1080,
    width: brandAssets.authBackground.width
  },
  authBackgroundMobile540: {
    alt: brandAssets.authBackground540.alt,
    height: brandAssets.authBackground540.height,
    source: mobileBackground540,
    width: brandAssets.authBackground540.width
  },
  authBackgroundMobile720: {
    alt: brandAssets.authBackground720.alt,
    height: brandAssets.authBackground720.height,
    source: mobileBackground720,
    width: brandAssets.authBackground720.width
  },
  logoSymbolDark: {
    alt: brandAssets.logoSymbolRed.alt,
    height: brandAssets.logoSymbolRed.height,
    source: logoSymbolRed,
    width: brandAssets.logoSymbolRed.width
  },
  logoSymbolWhite: {
    alt: brandAssets.logoSymbolWhite.alt,
    height: brandAssets.logoSymbolWhite.height,
    source: logoSymbolWhite,
    width: brandAssets.logoSymbolWhite.width
  }
} as const satisfies Record<string, WebBrandImage>;
