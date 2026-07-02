import { Image, StyleSheet, View } from "react-native";

import { brandImages } from "../../assets/brand-images";
import { theme } from "../../design-system/theme";
import { AppText } from "../ui/AppText";

type BrandSignatureVariant = "emblem" | "header";

export type BrandSignatureProps = Readonly<{
  variant: BrandSignatureVariant;
}>;

export function BrandSignature({ variant }: BrandSignatureProps) {
  if (variant === "emblem") {
    return (
      <Image
        accessibilityIgnoresInvertColors
        accessibilityLabel={brandImages.logoSymbolDark.alt}
        resizeMode="contain"
        source={brandImages.logoSymbolDark.source}
        style={styles.emblem}
      />
    );
  }

  return (
    <View accessibilityLabel="Corsica Linea" accessibilityRole="image" style={styles.header}>
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={brandImages.logoSymbolWhite.source}
        style={styles.headerMark}
      />
      <AppText tone="inverse" variant="brand">
        CORSICA linea
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  emblem: {
    height: theme.iconSizes.brandSheet,
    tintColor: theme.colors.foreground,
    width: theme.iconSizes.brandSheet
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing[2]
  },
  headerMark: {
    height: theme.iconSizes.brandHeader,
    width: theme.iconSizes.brandHeader
  }
});
