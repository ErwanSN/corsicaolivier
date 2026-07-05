import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "../../../components/ui/AppText";
import { theme } from "../../../design-system/theme";

export type AuthFormHeaderProps = Readonly<{
  onBack: () => void;
}>;

export function AuthFormHeader({ onBack }: AuthFormHeaderProps) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel="Retour à l'accueil"
        accessibilityRole="button"
        hitSlop={theme.hitSlop.control}
        onPress={onBack}
        style={styles.closeButton}
      >
        <AppText align="center" style={styles.closeGlyph} variant="body">
          ×
        </AppText>
      </Pressable>

      <AppText
        accessibilityRole="header"
        align="center"
        numberOfLines={1}
        style={styles.title}
        variant="controlLarge"
      >
        Connexion ou inscription
      </AppText>

      <View style={styles.spacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  closeButton: {
    alignItems: "center",
    borderRadius: theme.radii.pill,
    height: 38,
    justifyContent: "center",
    width: 38
  },
  closeGlyph: {
    fontSize: 26,
    lineHeight: 30
  },
  header: {
    alignItems: "center",
    borderBottomColor: theme.colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    minHeight: 64,
    paddingHorizontal: theme.spacing[4]
  },
  spacer: {
    height: 38,
    width: 38
  },
  title: {
    flex: 1
  }
});
