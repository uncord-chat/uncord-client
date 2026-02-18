import { memo, useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { Colors, SemanticColors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export type PresenceStatus = "online" | "idle" | "dnd" | "offline";

type PresenceDotProps = {
  status: PresenceStatus;
  size?: number;
  borderColor?: string;
};

function dotColour(status: PresenceStatus, scheme: "light" | "dark"): string {
  switch (status) {
    case "online":
      return SemanticColors.success;
    case "idle":
      return SemanticColors.warning;
    case "dnd":
      return SemanticColors.danger;
    default:
      return Colors[scheme].icon;
  }
}

export const PresenceDot = memo(function PresenceDot({ status, size = 10, borderColor }: PresenceDotProps) {
  const scheme = useColorScheme();
  const colour = dotColour(status, scheme);

  const dotStyle = useMemo(
    () => [
      styles.dot,
      {
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colour,
        borderColor: borderColor ?? "transparent",
      },
    ],
    [size, colour, borderColor],
  );

  return <View style={dotStyle} accessibilityLabel={`Status: ${status}`} />;
});

const styles = StyleSheet.create({
  dot: {
    borderWidth: 2,
    borderColor: "transparent",
  },
});
