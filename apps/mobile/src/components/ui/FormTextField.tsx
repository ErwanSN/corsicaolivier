import { forwardRef } from "react";
import { StyleSheet, TextInput, type TextInputProps } from "react-native";

import { theme } from "../../design-system/theme";

type FormTextFieldPosition = "first" | "last" | "single";

export type FormTextFieldProps = TextInputProps & {
  fieldPosition?: FormTextFieldPosition;
};

export const FormTextField = forwardRef<TextInput, FormTextFieldProps>(function FormTextField(
  { fieldPosition = "single", style, ...textInputProps },
  ref
) {
  return (
    <TextInput
      {...textInputProps}
      ref={ref}
      placeholderTextColor={theme.colors.muted}
      selectionColor={theme.colors.foreground}
      style={[styles.input, inputPositionStyles[fieldPosition], style]}
    />
  );
});

const styles = StyleSheet.create({
  input: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: theme.colors.foreground,
    fontFamily: theme.fonts.sansRegular,
    fontSize: theme.fontSizes.body,
    height: 56,
    lineHeight: theme.lineHeights.body,
    paddingHorizontal: theme.spacing[4],
    width: "100%"
  }
});

const inputPositionStyles = StyleSheet.create({
  first: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0
  },
  last: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    marginTop: -1
  },
  single: {}
});
