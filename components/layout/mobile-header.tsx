import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

type MobileHeaderProps = {
  channelName?: string;
  onMenuPress: () => void;
};

export const MobileHeader = memo(function MobileHeader({ channelName, onMenuPress }: MobileHeaderProps) {
  const colorScheme = useColorScheme();
  const textColor = Colors[colorScheme].text;
  const mutedColor = Colors[colorScheme].icon;
  const borderColor = Colors[colorScheme].border;

  return (
    <View style={[styles.container, { borderBottomColor: borderColor }]}>
      <Pressable
        style={styles.menuButton}
        onPress={onMenuPress}
        accessibilityRole="button"
        accessibilityLabel="Open navigation menu"
      >
        <Text style={[styles.menuIcon, { color: mutedColor }]}>{"\u2630"}</Text>
      </Pressable>
      {channelName ? (
        <View style={styles.titleRow}>
          <Text style={[styles.hash, { color: mutedColor }]} accessibilityLabel="Channel symbol">
            #
          </Text>
          <Text style={[styles.channelName, { color: textColor }]}>{channelName}</Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  menuButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  menuIcon: {
    fontSize: 22,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 4,
  },
  hash: {
    fontSize: 18,
    fontWeight: "600",
    marginRight: 2,
  },
  channelName: {
    fontSize: 16,
    fontWeight: "700",
  },
});
