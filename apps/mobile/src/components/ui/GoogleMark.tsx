import { Image, StyleSheet } from "react-native";

import { identityImages } from "../../assets/identity-images";
import { theme } from "../../design-system/theme";

export function GoogleMark() {
  return (
    <Image
      accessibilityIgnoresInvertColors
      accessible={false}
      importantForAccessibility="no"
      resizeMode="contain"
      source={identityImages.googleMark.source}
      style={styles.mark}
    />
  );
}

const styles = StyleSheet.create({
  mark: {
    height: theme.iconSizes.social,
    width: theme.iconSizes.social
  }
});
