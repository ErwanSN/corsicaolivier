import { getApiClientErrorMessage } from "@corsica/api-client";
import { useRef, useState } from "react";
import { Pressable, ScrollView, StatusBar, StyleSheet, type TextInput, View } from "react-native";

import { AppButton } from "../../../components/ui/AppButton";
import { AppText } from "../../../components/ui/AppText";
import { FormTextField } from "../../../components/ui/FormTextField";
import { GoogleMark } from "../../../components/ui/GoogleMark";
import { Separator } from "../../../components/ui/Separator";
import { theme } from "../../../design-system/theme";
import { type AuthFormMode, type AuthSubmitHandler } from "../auth.types";

export type AuthFormScreenProps = Readonly<{
  mode: AuthFormMode;
  onBack: () => void;
  onSubmit: AuthSubmitHandler;
  onSwitchMode: (mode: AuthFormMode) => void;
}>;

const copyByMode = {
  createAccount: {
    loadingLabel: "Création...",
    passwordContentType: "newPassword",
    submitLabel: "Créer un compte",
    switchLabel: "Se connecter",
    switchMode: "signIn",
    switchPrefix: "Déjà un compte ?"
  },
  signIn: {
    loadingLabel: "Connexion...",
    passwordContentType: "password",
    submitLabel: "Se connecter",
    switchLabel: "Créer un compte",
    switchMode: "createAccount",
    switchPrefix: "Pas encore de compte ?"
  }
} as const satisfies Record<
  AuthFormMode,
  Readonly<{
    loadingLabel: string;
    passwordContentType: "newPassword" | "password";
    submitLabel: string;
    switchLabel: string;
    switchMode: AuthFormMode;
    switchPrefix: string;
  }>
>;

export function AuthFormScreen({ mode, onBack, onSubmit, onSwitchMode }: AuthFormScreenProps) {
  const copy = copyByMode[mode];
  const passwordInputRef = useRef<TextInput>(null);
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState("");

  async function handleSubmit(): Promise<void> {
    if (password.length < 8) {
      setErrorMessage("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await onSubmit({
        email,
        password
      });
    } catch (error) {
      setErrorMessage(getApiClientErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar backgroundColor={theme.colors.background} barStyle="dark-content" />

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

        <AppText align="center" numberOfLines={1} style={styles.headerTitle} variant="controlLarge">
          Connexion ou inscription
        </AppText>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.panel}>
          <AppText style={styles.title} variant="title">
            Bienvenue sur Corsica Linea
          </AppText>

          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <FormTextField
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSubmitting}
                fieldPosition="first"
                inputMode="email"
                keyboardType="email-address"
                onChangeText={setEmail}
                onSubmitEditing={() => {
                  passwordInputRef.current?.focus();
                }}
                placeholder="Email"
                returnKeyType="next"
                textContentType="emailAddress"
                value={email}
              />
              <FormTextField
                ref={passwordInputRef}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSubmitting}
                fieldPosition="last"
                onChangeText={setPassword}
                onSubmitEditing={() => {
                  void handleSubmit();
                }}
                placeholder="Mot de passe"
                returnKeyType="done"
                secureTextEntry
                textContentType={copy.passwordContentType}
                value={password}
              />
            </View>

            {errorMessage ? (
              <AppText tone="danger" variant="caption">
                {errorMessage}
              </AppText>
            ) : null}

            <AppButton
              disabled={isSubmitting}
              label={isSubmitting ? copy.loadingLabel : copy.submitLabel}
              onPress={() => {
                void handleSubmit();
              }}
              size="large"
              variant="brand"
            />
          </View>

          <Separator label="ou" />

          <AppButton
            disabled
            label="Continuer avec Google"
            leftAccessory={<GoogleMark />}
            onPress={() => undefined}
            variant="outline"
          />

          <View style={styles.switchRow}>
            <AppText align="center" tone="muted" variant="control">
              {copy.switchPrefix}
            </AppText>
            <Pressable
              accessibilityRole="button"
              hitSlop={theme.hitSlop.control}
              onPress={() => {
                onSwitchMode(copy.switchMode);
              }}
            >
              <AppText align="center" style={styles.switchLabel} variant="control">
                {copy.switchLabel}
              </AppText>
            </Pressable>
          </View>
        </View>
      </ScrollView>
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
  content: {
    flexGrow: 1,
    paddingBottom: theme.spacing[8],
    paddingHorizontal: theme.spacing[6],
    paddingTop: theme.spacing[7]
  },
  fieldGroup: {
    width: "100%"
  },
  form: {
    gap: theme.spacing[4],
    width: "100%"
  },
  header: {
    alignItems: "center",
    borderBottomColor: theme.colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    minHeight: 64,
    paddingHorizontal: theme.spacing[4]
  },
  headerSpacer: {
    height: 38,
    width: 38
  },
  headerTitle: {
    flex: 1
  },
  panel: {
    gap: theme.spacing[6],
    width: "100%"
  },
  root: {
    backgroundColor: theme.colors.background,
    flex: 1
  },
  switchLabel: {
    color: theme.colors.foreground,
    textDecorationLine: "underline"
  },
  switchRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing[2],
    justifyContent: "center"
  },
  title: {
    fontSize: 22,
    lineHeight: 28
  }
});
