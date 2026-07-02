import { brandAssets } from "@corsica/assets";
import { type ImageSourcePropType } from "react-native";

import authBackgroundSource from "../../../../packages/assets/brand/web/auth-background-1080.webp";
import logoSymbolRedSource from "../../../../packages/assets/brand/web/corsica-symbol-red.webp";
import logoSymbolWhiteSource from "../../../../packages/assets/brand/web/corsica-symbol-white.webp";

type MobileBrandImage = Readonly<{
  alt: string;
  height: number;
  source: ImageSourcePropType;
  width: number;
}>;

export const brandImages = {
  authBackground: {
    alt: brandAssets.authBackground.alt,
    height: brandAssets.authBackground.height,
    source: authBackgroundSource,
    width: brandAssets.authBackground.width
  },
  logoSymbolDark: {
    alt: brandAssets.logoSymbolRed.alt,
    height: brandAssets.logoSymbolRed.height,
    source: logoSymbolRedSource,
    width: brandAssets.logoSymbolRed.width
  },
  logoSymbolWhite: {
    alt: brandAssets.logoSymbolWhite.alt,
    height: brandAssets.logoSymbolWhite.height,
    source: logoSymbolWhiteSource,
    width: brandAssets.logoSymbolWhite.width
  }
} as const satisfies Record<string, MobileBrandImage>;
