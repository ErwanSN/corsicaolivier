import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import { useFonts } from "expo-font";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { theme } from "./design-system/theme";
import { AuthScreen } from "./features/auth/AuthScreen";

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold
  });

  if (!fontsLoaded && !fontError)
    return (
      <View accessibilityLabel="Chargement de l’application" style={styles.loading}>
        <ActivityIndicator color={theme.colors.brand} size="large" />
      </View>
    );
  if (fontError)
    return (
      <View accessibilityRole="alert" style={styles.loading}>
        <Text style={styles.error}>Impossible de charger les ressources de l’application.</Text>
      </View>
    );

  return <AuthScreen />;
}

const styles = StyleSheet.create({
  error: {
    color: theme.colors.foreground,
    fontSize: 16,
    textAlign: "center"
  },
  loading: {
    alignItems: "center",
    backgroundColor: theme.colors.background,
    flex: 1,
    justifyContent: "center",
    padding: theme.spacing[6]
  }
});
