import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

type ChannelHeaderProps = {
  name: string;
  topic?: string;
};

export const ChannelHeader = memo(function ChannelHeader({ name, topic }: ChannelHeaderProps) {
  const colorScheme = useColorScheme();
  const textColor = Colors[colorScheme].text;
  const mutedColor = Colors[colorScheme].icon;
  const borderColor = Colors[colorScheme].border;

  return (
    <View style={[styles.container, { borderBottomColor: borderColor }]}>
      <Text style={[styles.hash, { color: mutedColor }]} accessibilityLabel="channel">
        #
      </Text>
      <Text style={[styles.name, { color: textColor }]}>{name}</Text>
      {topic ? (
        <>
          <View style={[styles.divider, { backgroundColor: mutedColor }]} />
          <Text style={[styles.topic, { color: mutedColor }]} numberOfLines={1}>
            {topic}
          </Text>
        </>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  hash: {
    fontSize: 20,
    fontWeight: "600",
    marginRight: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
  },
  divider: {
    width: 1,
    height: 20,
    marginHorizontal: 12,
    opacity: 0.3,
  },
  topic: {
    fontSize: 13,
    flex: 1,
  },
});
