import { colors, fontSizes, fonts, lineHeights, radii, spacing } from "@corsica/ui";

export const theme = {
  colors,
  fontSizes,
  fonts,
  hitSlop: {
    control: {
      bottom: 8,
      left: 8,
      right: 8,
      top: 8
    }
  },
  iconSizes: {
    brandHeader: 22,
    brandSheet: 30,
    social: 18
  },
  lineHeights,
  radii,
  spacing
} as const;
