import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/common/avatar";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { formatTime } from "@/lib/format";
import type { Message } from "@uncord-chat/protocol/models/message";

type MessageItemProps = {
  message: Message;
  isGrouped: boolean;
};

export const MessageItem = memo(function MessageItem({ message, isGrouped }: MessageItemProps) {
  const colorScheme = useColorScheme();
  const textColor = Colors[colorScheme].text;
  const mutedColor = Colors[colorScheme].icon;
  const authorName = message.author.display_name ?? message.author.username;

  if (isGrouped) {
    return (
      <View style={styles.groupedRow} accessible accessibilityLabel={`${authorName}: ${message.content}`}>
        <View style={styles.avatarSpacer} />
        <Text style={[styles.content, { color: textColor }]}>{message.content}</Text>
      </View>
    );
  }

  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${authorName} at ${formatTime(message.created_at)}: ${message.content}`}
    >
      <Avatar name={authorName} size={40} />
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Text style={[styles.authorName, { color: textColor }]}>{authorName}</Text>
          <Text
            style={[styles.timestamp, { color: mutedColor }]}
            accessibilityLabel={`Sent ${formatTime(message.created_at)}`}
          >
            {formatTime(message.created_at)}
          </Text>
        </View>
        <Text style={[styles.content, { color: textColor }]}>{message.content}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 2,
    gap: 12,
  },
  groupedRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 1,
    gap: 12,
  },
  avatarSpacer: {
    width: 40,
  },
  body: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  authorName: {
    fontSize: 15,
    fontWeight: "600",
  },
  timestamp: {
    fontSize: 11,
  },
  content: {
    fontSize: 15,
    lineHeight: 22,
  },
});
