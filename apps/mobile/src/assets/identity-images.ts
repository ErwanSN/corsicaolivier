import { identityAssets } from "@corsica/assets";
import { type ImageSourcePropType } from "react-native";

import googleMarkSource from "../../../../packages/assets/identity/web/google-g-icon.webp";

type MobileIdentityImage = Readonly<{
  alt: string;
  height: number;
  source: ImageSourcePropType;
  width: number;
}>;

export const identityImages = {
  googleMark: {
    alt: identityAssets.googleMark.alt,
    height: identityAssets.googleMark.height,
    source: googleMarkSource,
    width: identityAssets.googleMark.width
  }
} as const satisfies Record<string, MobileIdentityImage>;
