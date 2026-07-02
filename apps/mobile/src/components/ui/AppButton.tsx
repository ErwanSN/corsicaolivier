import { type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { theme } from "../../design-system/theme";
import { AppText } from "./AppText";

type AppButtonVariant = "brand" | "outline" | "primary" | "secondary";
type AppButtonSize = "large" | "regular";

export type AppButtonProps = Readonly<{
  accessibilityLabel?: string;
  disabled?: boolean;
  label: string;
  leftAccessory?: ReactNode;
  onPress: () => void;
  size?: AppButtonSize;
  variant?: AppButtonVariant;
}>;

export function AppButton({
  accessibilityLabel,
  disabled = false,
  label,
  leftAccessory,
  onPress,
  size = "regular",
  variant = "primary"
}: AppButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      disabled={disabled}
      hitSlop={theme.hitSlop.control}
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        containerSizeStyles[size],
        containerVariantStyles[variant],
        disabled ? styles.disabled : null,
        pressed ? styles.pressed : null
      ]}
    >
      <View style={styles.content}>
        {leftAccessory ? <View style={styles.accessory}>{leftAccessory}</View> : null}
        <AppText
          align="center"
          tone={labelToneByVariant[variant]}
          variant={labelVariantBySize[size]}
        >
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  accessory: {
    alignItems: "center",
    height: theme.iconSizes.social,
    justifyContent: "center",
    width: theme.iconSizes.social
  },
  container: {
    alignItems: "center",
    borderRadius: theme.radii.pill,
    justifyContent: "center",
    overflow: "hidden",
    width: "100%"
  },
  content: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing[3],
    justifyContent: "center"
  },
  disabled: {
    opacity: 0.42
  },
  pressed: {
    opacity: 0.82
  }
});

const containerVariantStyles = StyleSheet.create({
  brand: {
    backgroundColor: theme.colors.brand
  },
  outline: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1
  },
  primary: {
    backgroundColor: theme.colors.surfaceInverse
  },
  secondary: {
    backgroundColor: theme.colors.surface
  }
});

const containerSizeStyles = StyleSheet.create({
  large: {
    height: 48,
    minWidth: 184,
    paddingHorizontal: theme.spacing[6]
  },
  regular: {
    height: 35,
    minWidth: 160,
    paddingHorizontal: theme.spacing[5]
  }
});

const labelToneByVariant = {
  brand: "inverse",
  outline: "primary",
  primary: "inverse",
  secondary: "primary"
} as const satisfies Record<AppButtonVariant, "inverse" | "primary">;

const labelVariantBySize = {
  large: "controlLarge",
  regular: "control"
} as const satisfies Record<AppButtonSize, "control" | "controlLarge">;
