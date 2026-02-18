import { memo, useCallback, useMemo } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";

import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { Message } from "@uncord-chat/protocol/models/message";

import { MessageItem } from "./message-item";

type MessageWithGrouping = {
  message: Message;
  isGrouped: boolean;
};

type MessageListProps = {
  messages: Message[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
};

const FIVE_MINUTES = 5 * 60 * 1000;

function shouldGroup(current: Message, previous: Message | undefined): boolean {
  if (!previous) return false;
  if (current.author.id !== previous.author.id) return false;
  const diff = new Date(current.created_at).getTime() - new Date(previous.created_at).getTime();
  return Math.abs(diff) < FIVE_MINUTES;
}

function keyExtractor(item: MessageWithGrouping): string {
  return item.message.id;
}

export const MessageList = memo(function MessageList({
  messages,
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
}: MessageListProps) {
  const colorScheme = useColorScheme();
  const tint = Colors[colorScheme].tint;

  // Pre-compute grouping so renderItem does not close over the messages array.
  const data = useMemo<MessageWithGrouping[]>(
    () =>
      messages.map((msg, i) => ({
        message: msg,
        isGrouped: shouldGroup(msg, messages[i + 1]),
      })),
    [messages],
  );

  const renderItem = useCallback(({ item }: { item: MessageWithGrouping }) => {
    return <MessageItem message={item.message} isGrouped={item.isGrouped} />;
  }, []);

  const handleEndReached = hasMore ? onLoadMore : undefined;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={tint} />
      </View>
    );
  }

  return (
    <FlatList
      data={data}
      inverted
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.3}
      accessibilityRole="list"
      accessibilityLabel="Messages"
      ListFooterComponent={
        loadingMore ? (
          <View style={styles.loadingMore}>
            <ActivityIndicator size="small" color={tint} />
          </View>
        ) : null
      }
      contentContainerStyle={styles.list}
      removeClippedSubviews
      maxToRenderPerBatch={20}
      windowSize={11}
    />
  );
});

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  list: {
    paddingBottom: 8,
  },
  loadingMore: {
    padding: 16,
    alignItems: "center",
  },
});
