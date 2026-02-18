import { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { SemanticColors } from "@/constants/theme";
import { colourFromName } from "@/lib/colour";

type AvatarProps = {
  name: string;
  size: number;
};

export const Avatar = memo(function Avatar({ name, size }: AvatarProps) {
  const letter = (name[0] ?? "?").toUpperCase();
  const bg = colourFromName(name);
  const fontSize = size * 0.45;

  const containerStyle = useMemo(
    () => [styles.container, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }],
    [size, bg],
  );

  const textStyle = useMemo(() => [styles.letter, { fontSize, lineHeight: fontSize * 1.2 }], [fontSize]);

  return (
    <View style={containerStyle} accessibilityRole="image" accessibilityLabel={`${name} avatar`}>
      <Text style={textStyle}>{letter}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  letter: {
    color: SemanticColors.contrastText,
    fontWeight: "700",
  },
});
