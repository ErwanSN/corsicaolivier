import { type PropsWithChildren } from "react";
import { Text, type TextProps, StyleSheet } from "react-native";

import { theme } from "../../design-system/theme";

type AppTextAlign = "center" | "left";
type AppTextTone = "danger" | "inverse" | "muted" | "primary";
type AppTextVariant = "body" | "brand" | "caption" | "control" | "controlLarge" | "title";

export type AppTextProps = PropsWithChildren<
  TextProps & {
    align?: AppTextAlign;
    tone?: AppTextTone;
    variant?: AppTextVariant;
  }
>;

export function AppText({
  align = "left",
  children,
  style,
  tone = "primary",
  variant = "body",
  ...textProps
}: AppTextProps) {
  return (
    <Text
      {...textProps}
      style={[styles.base, variantStyles[variant], toneStyles[tone], alignStyles[align], style]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    includeFontPadding: false
  }
});

const alignStyles = StyleSheet.create({
  center: {
    textAlign: "center"
  },
  left: {
    textAlign: "left"
  }
});

const toneStyles = StyleSheet.create({
  danger: {
    color: theme.colors.brand
  },
  inverse: {
    color: theme.colors.background
  },
  muted: {
    color: theme.colors.muted
  },
  primary: {
    color: theme.colors.foreground
  }
});

const variantStyles = StyleSheet.create({
  body: {
    fontFamily: theme.fonts.sansRegular,
    fontSize: theme.fontSizes.body,
    lineHeight: theme.lineHeights.body
  },
  brand: {
    fontFamily: theme.fonts.sansBold,
    fontSize: 12,
    letterSpacing: 0,
    lineHeight: 15
  },
  caption: {
    fontFamily: theme.fonts.sansRegular,
    fontSize: theme.fontSizes.caption,
    lineHeight: theme.lineHeights.caption
  },
  control: {
    fontFamily: theme.fonts.sansMedium,
    fontSize: theme.fontSizes.control,
    lineHeight: theme.lineHeights.control
  },
  controlLarge: {
    fontFamily: theme.fonts.sansMedium,
    fontSize: theme.fontSizes.controlLarge,
    lineHeight: theme.lineHeights.controlLarge
  },
  title: {
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: theme.fontSizes.title,
    lineHeight: theme.lineHeights.title
  }
});
