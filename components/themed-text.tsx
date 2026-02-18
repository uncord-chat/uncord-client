import { memo } from "react";
import { StyleSheet, Text, type TextProps } from "react-native";

import { useThemeColor } from "@/hooks/use-theme-color";

type TextType = "default" | "title" | "defaultSemiBold" | "subtitle" | "link";

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: TextType;
};

export const ThemedText = memo(function ThemedText({
  style,
  lightColor,
  darkColor,
  type = "default",
  ...rest
}: ThemedTextProps) {
  const textColor = useThemeColor({ light: lightColor, dark: darkColor }, "text");
  const tintColor = useThemeColor({}, "tint");
  const color = type === "link" ? tintColor : textColor;

  return <Text style={[{ color }, typeStyles[type], style]} {...rest} />;
});

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  link: {
    lineHeight: 30,
    fontSize: 16,
  },
});

const typeStyles: Record<TextType, (typeof styles)[keyof typeof styles]> = {
  default: styles.default,
  title: styles.title,
  defaultSemiBold: styles.defaultSemiBold,
  subtitle: styles.subtitle,
  link: styles.link,
};
