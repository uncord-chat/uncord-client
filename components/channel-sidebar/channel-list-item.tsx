import { memo, useCallback } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { Colors, SidebarColors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

type ChannelListItemProps = {
  id: string;
  name: string;
  isActive: boolean;
  onPress: (id: string) => void;
};

export const ChannelListItem = memo(function ChannelListItem({ id, name, isActive, onPress }: ChannelListItemProps) {
  const colorScheme = useColorScheme();
  const colors = SidebarColors[colorScheme];
  const textColor = Colors[colorScheme].text;
  const mutedColor = Colors[colorScheme].icon;

  const handlePress = useCallback(() => onPress(id), [id, onPress]);

  return (
    <Pressable
      style={[styles.item, isActive && { backgroundColor: colors.channelActive }]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${name} channel`}
      accessibilityState={{ selected: isActive }}
    >
      <Text style={[styles.hash, { color: mutedColor }]} accessibilityLabel="channel">
        #
      </Text>
      <Text style={[styles.name, { color: isActive ? textColor : mutedColor }]} numberOfLines={1}>
        {name}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginHorizontal: 8,
    borderRadius: 4,
  },
  hash: {
    fontSize: 16,
    fontWeight: "600",
    marginRight: 6,
    width: 16,
    textAlign: "center",
  },
  name: {
    fontSize: 15,
    flex: 1,
  },
});
