import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

type RoleGroupHeaderProps = {
  name: string;
  count: number;
};

export const RoleGroupHeader = memo(function RoleGroupHeader({ name, count }: RoleGroupHeaderProps) {
  const scheme = useColorScheme();
  const color = Colors[scheme].icon;

  return (
    <View style={styles.container}>
      <Text style={[styles.text, { color }]}>
        {name.toUpperCase()} — {count}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
    paddingTop: 20,
    paddingBottom: 6,
  },
  text: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
