import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "../../../components/ui/AppText";
import { theme } from "../../../design-system/theme";
import { type AuthFormMode } from "../auth.types";

export type AuthModeSwitchRowProps = Readonly<{
  mode: AuthFormMode;
  onSwitchMode: (mode: AuthFormMode) => void;
}>;

const copyByMode = {
  createAccount: {
    label: "Se connecter",
    mode: "signIn",
    prefix: "Déjà un compte ?"
  },
  signIn: {
    label: "Créer un compte",
    mode: "createAccount",
    prefix: "Pas encore de compte ?"
  }
} as const satisfies Record<
  AuthFormMode,
  Readonly<{
    label: string;
    mode: AuthFormMode;
    prefix: string;
  }>
>;

export function AuthModeSwitchRow({ mode, onSwitchMode }: AuthModeSwitchRowProps) {
  const copy = copyByMode[mode];

  return (
    <View style={styles.row}>
      <AppText align="center" tone="muted" variant="control">
        {copy.prefix}
      </AppText>
      <Pressable
        accessibilityRole="button"
        hitSlop={theme.hitSlop.control}
        onPress={() => {
          onSwitchMode(copy.mode);
        }}
      >
        <AppText align="center" style={styles.label} variant="control">
          {copy.label}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: theme.colors.foreground,
    textDecorationLine: "underline"
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing[2],
    justifyContent: "center"
  }
});
