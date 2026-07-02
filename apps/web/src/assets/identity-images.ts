import { identityAssets } from "@corsica/assets";
import { type StaticImageData } from "next/image";

import googleMarkSource from "../../../../packages/assets/identity/web/google-g-icon.webp";

type WebIdentityImage = Readonly<{
  alt: string;
  height: number;
  source: StaticImageData;
  width: number;
}>;

export const webIdentityImages = {
  googleMark: {
    alt: identityAssets.googleMark.alt,
    height: identityAssets.googleMark.height,
    source: googleMarkSource,
    width: identityAssets.googleMark.width
  }
} as const satisfies Record<string, WebIdentityImage>;
