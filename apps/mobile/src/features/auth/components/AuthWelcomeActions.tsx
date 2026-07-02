import { StyleSheet, View } from "react-native";

import { AppButton } from "../../../components/ui/AppButton";
import { theme } from "../../../design-system/theme";

export type AuthWelcomeActionsProps = Readonly<{
  onCreateAccount: () => void;
  onLogin: () => void;
}>;

export function AuthWelcomeActions({ onCreateAccount, onLogin }: AuthWelcomeActionsProps) {
  return (
    <View style={styles.container}>
      <AppButton
        label="Créer un compte"
        onPress={onCreateAccount}
        size="large"
        variant="secondary"
      />
      <AppButton label="Se connecter" onPress={onLogin} size="large" variant="primary" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "center",
    gap: theme.spacing[3],
    maxWidth: 300,
    width: "100%"
  }
});
