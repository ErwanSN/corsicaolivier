import { StyleSheet, View } from "react-native";

import { theme } from "../../design-system/theme";
import { AppText } from "./AppText";

export type SeparatorProps = Readonly<{
  label: string;
}>;

export function Separator({ label }: SeparatorProps) {
  return (
    <View style={styles.container}>
      <View style={styles.line} />
      <AppText align="center" tone="muted" variant="caption">
        {label}
      </AppText>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing[3],
    height: 18,
    justifyContent: "center",
    width: "100%"
  },
  line: {
    backgroundColor: theme.colors.border,
    flex: 1,
    height: 1
  }
});
