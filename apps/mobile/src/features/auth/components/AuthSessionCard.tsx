import { type AuthSessionDto } from "@corsica/contracts";
import { StyleSheet, View } from "react-native";

import { BrandSignature } from "../../../components/brand/BrandSignature";
import { AppButton } from "../../../components/ui/AppButton";
import { AppText } from "../../../components/ui/AppText";
import { theme } from "../../../design-system/theme";

export type AuthSessionCardProps = Readonly<{
  onLogout: () => void;
  session: AuthSessionDto;
}>;

export function AuthSessionCard({ onLogout, session }: AuthSessionCardProps) {
  return (
    <View style={styles.card}>
      <BrandSignature variant="emblem" />
      <AppText align="center" variant="title">
        Bienvenue
      </AppText>
      <AppText align="center" variant="control">
        {session.user.email}
      </AppText>
      <AppButton label="Se déconnecter" onPress={onLogout} variant="primary" />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.sheet,
    gap: theme.spacing[4],
    maxWidth: 320,
    paddingHorizontal: theme.spacing[9],
    paddingVertical: theme.spacing[8],
    width: "100%"
  }
});
