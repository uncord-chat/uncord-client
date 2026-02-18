import { Slot } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ChannelSidebar } from "@/components/channel-sidebar/channel-sidebar";
import { ErrorBoundary } from "@/components/error-boundary";
import { MemberSidebar } from "@/components/member-sidebar/member-sidebar";
import { ServerSidebar } from "@/components/server-sidebar/server-sidebar";
import { useCurrentRoute } from "@/hooks/use-current-route";
import { useServerDataActions, useServerDataState } from "@/lib/server-data/server-data-context";

type AuthenticatedDesktopProps = {
  backgroundColor: string;
};

export function AuthenticatedDesktop({ backgroundColor }: AuthenticatedDesktopProps) {
  const { currentChannelId } = useServerDataState();
  const { setCurrentChannel } = useServerDataActions();
  const route = useCurrentRoute();
  const isSettings = route === "settings";
  const isChannelRoute = route === "channel";

  // Clear channel selection when navigating away from a channel route
  // (e.g. clicking a server icon, opening settings).
  useEffect(() => {
    if (!isChannelRoute && currentChannelId) {
      setCurrentChannel(null);
    }
  }, [isChannelRoute, currentChannelId, setCurrentChannel]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <ErrorBoundary>
        <ServerSidebar />
      </ErrorBoundary>
      {!isSettings && (
        <ErrorBoundary>
          <ChannelSidebar />
        </ErrorBoundary>
      )}
      <View style={styles.content}>
        <ErrorBoundary style={styles.content}>
          <Slot />
        </ErrorBoundary>
      </View>
      {isChannelRoute && currentChannelId && (
        <ErrorBoundary>
          <MemberSidebar channelId={currentChannelId} />
        </ErrorBoundary>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
  },
  content: {
    flex: 1,
  },
});
