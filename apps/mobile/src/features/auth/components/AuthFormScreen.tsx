import { useRef } from "react";
import { ScrollView, StatusBar, StyleSheet, type TextInput, View } from "react-native";

import { AppButton } from "../../../components/ui/AppButton";
import { AppText } from "../../../components/ui/AppText";
import { FormTextField } from "../../../components/ui/FormTextField";
import { GoogleMark } from "../../../components/ui/GoogleMark";
import { Separator } from "../../../components/ui/Separator";
import { theme } from "../../../design-system/theme";
import { type AuthFormMode, type AuthSubmitHandler } from "../auth.types";
import { useAuthForm } from "../use-auth-form";
import { AuthFormHeader } from "./AuthFormHeader";
import { AuthModeSwitchRow } from "./AuthModeSwitchRow";

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
    submitLabel: "Créer un compte"
  },
  signIn: {
    loadingLabel: "Connexion...",
    passwordContentType: "password",
    submitLabel: "Se connecter"
  }
} as const satisfies Record<
  AuthFormMode,
  Readonly<{
    loadingLabel: string;
    passwordContentType: "newPassword" | "password";
    submitLabel: string;
  }>
>;

export function AuthFormScreen({ mode, onBack, onSubmit, onSwitchMode }: AuthFormScreenProps) {
  const copy = copyByMode[mode];
  const passwordInputRef = useRef<TextInput>(null);
  const form = useAuthForm(mode, onSubmit);

  return (
    <View style={styles.root}>
      <StatusBar backgroundColor={theme.colors.background} barStyle="dark-content" />

      <AuthFormHeader onBack={onBack} />

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
                editable={!form.isSubmitting}
                fieldPosition="first"
                inputMode="email"
                keyboardType="email-address"
                onChangeText={form.setEmail}
                onSubmitEditing={() => {
                  passwordInputRef.current?.focus();
                }}
                placeholder="Email"
                returnKeyType="next"
                textContentType="emailAddress"
                value={form.email}
              />
              <FormTextField
                ref={passwordInputRef}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!form.isSubmitting}
                fieldPosition="last"
                onChangeText={form.setPassword}
                onSubmitEditing={() => {
                  void form.submit();
                }}
                placeholder="Mot de passe"
                returnKeyType="done"
                secureTextEntry
                textContentType={copy.passwordContentType}
                value={form.password}
              />
            </View>

            {form.errorMessage ? (
              <AppText
                accessibilityLiveRegion="polite"
                accessibilityRole="alert"
                tone="danger"
                variant="caption"
              >
                {form.errorMessage}
              </AppText>
            ) : null}

            <AppButton
              disabled={form.isSubmitting}
              label={form.isSubmitting ? copy.loadingLabel : copy.submitLabel}
              onPress={() => {
                void form.submit();
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

          <AuthModeSwitchRow mode={mode} onSwitchMode={onSwitchMode} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
  panel: {
    gap: theme.spacing[6],
    width: "100%"
  },
  root: {
    backgroundColor: theme.colors.background,
    flex: 1
  },
  title: {
    fontSize: 22,
    lineHeight: 28
  }
});
