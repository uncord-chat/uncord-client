import { Slot } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ChannelSidebar } from "@/components/channel-sidebar/channel-sidebar";
import { ErrorBoundary } from "@/components/error-boundary";
import { MobileDrawer } from "@/components/layout/mobile-drawer";
import { MobileHeader } from "@/components/layout/mobile-header";
import { ServerSidebar } from "@/components/server-sidebar/server-sidebar";
import { useServerDataState } from "@/lib/server-data/server-data-context";

type AuthenticatedMobileProps = {
  backgroundColor: string;
};

export function AuthenticatedMobile({ backgroundColor }: AuthenticatedMobileProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { channels, currentChannelId } = useServerDataState();
  const currentChannel = useMemo(() => channels.find((c) => c.id === currentChannelId), [channels, currentChannelId]);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // Close drawer when navigating to a channel
  useEffect(() => {
    if (currentChannelId) {
      setDrawerOpen(false);
    }
  }, [currentChannelId]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <MobileHeader channelName={currentChannel?.name} onMenuPress={openDrawer} />
      <View style={styles.content}>
        <ErrorBoundary style={styles.content}>
          <Slot />
        </ErrorBoundary>
      </View>
      <MobileDrawer open={drawerOpen} onClose={closeDrawer}>
        <ServerSidebar />
        <ChannelSidebar />
      </MobileDrawer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
