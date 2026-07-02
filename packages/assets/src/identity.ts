export type IdentityAsset = Readonly<{
  alt: string;
  height: number;
  source: string;
  type: "image/webp";
  width: number;
}>;

export const identityAssets = {
  googleMark: {
    alt: "Google",
    height: 80,
    source: "identity/web/google-g-icon.webp",
    type: "image/webp",
    width: 80
  }
} as const satisfies Record<string, IdentityAsset>;
