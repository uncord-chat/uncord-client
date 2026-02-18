import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet } from "react-native";

import { ThemedView } from "@/components/themed-view";

import { ChannelHeader } from "@/components/chat/channel-header";
import { IOS_KEYBOARD_VERTICAL_OFFSET } from "@/constants/layout";
import { MessageInput } from "@/components/chat/message-input";
import { MessageList } from "@/components/chat/message-list";
import { TypingIndicator } from "@/components/chat/typing-indicator";
import { ThemedText } from "@/components/themed-text";
import { SemanticColors } from "@/constants/theme";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { useGatewayMessages } from "@/lib/gateway/use-gateway-messages";
import { useChannelMessages } from "@/lib/messages/use-channel-messages";
import { useServerDataActions, useServerDataState } from "@/lib/server-data/server-data-context";
import { useTypingIndicator } from "@/lib/typing/use-typing-indicator";
import { useTypingUsers } from "@/lib/typing/use-typing-users";

export default function ChannelScreen(): React.ReactElement {
  const { channelId } = useLocalSearchParams<{ channelId: string }>();
  const { channels } = useServerDataState();
  const { setCurrentChannel } = useServerDataActions();
  const isDesktop = useIsDesktop();

  const channel = useMemo(() => channels.find((c) => c.id === channelId), [channels, channelId]);
  const { messages, setMessages, loading, loadingMore, hasMore, error, sendMessage, loadMore } = useChannelMessages(
    channelId ?? null,
  );

  useGatewayMessages(channelId ?? null, setMessages);

  const typingUsers = useTypingUsers(channelId ?? null);
  const { handleTyping, handleStopTyping, clearTypingState } = useTypingIndicator(channelId ?? null);

  const handleSend = useCallback(
    (content: string) => {
      clearTypingState();
      sendMessage(content);
    },
    [clearTypingState, sendMessage],
  );

  useEffect(() => {
    if (channelId) {
      setCurrentChannel(channelId);
    }
  }, [channelId, setCurrentChannel]);

  if (!channelId || (!loading && !channel)) {
    return (
      <ThemedView style={styles.notFound}>
        <ThemedText>Channel not found</ThemedText>
      </ThemedView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? IOS_KEYBOARD_VERTICAL_OFFSET : 0}
    >
      {isDesktop && <ChannelHeader name={channel?.name ?? "channel"} topic={channel?.topic} />}
      <MessageList
        messages={messages}
        loading={loading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        onLoadMore={loadMore}
      />
      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
      <TypingIndicator userIds={typingUsers} />
      <MessageInput
        channelName={channel?.name ?? "channel"}
        onSend={handleSend}
        onTyping={handleTyping}
        onStopTyping={handleStopTyping}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  notFound: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  error: {
    color: SemanticColors.error,
    paddingHorizontal: 16,
    paddingBottom: 4,
    fontSize: 13,
  },
});
