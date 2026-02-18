import { useRouter } from "expo-router";
import { memo, useCallback, useState } from "react";
import {
  Alert,
  type GestureResponderEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { SERVER_SIDEBAR_WIDTH } from "@/constants/layout";
import { Routes } from "@/constants/routes";
import { SidebarColors, SemanticColors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuthActions, useAuthState } from "@/lib/auth/auth-context";
import { confirmAsync } from "@/lib/platform";

import { ServerContextMenu } from "./server-context-menu";
import { ServerIcon } from "./server-icon";

type ContextMenuState = { serverId: string; x: number; y: number } | null;

export const ServerSidebar = memo(function ServerSidebar() {
  const { servers, currentServerId, users } = useAuthState();
  const { setCurrentServer, removeServer } = useAuthActions();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = SidebarColors[colorScheme];
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);

  const handleSelect = useCallback(
    (serverId: string) => {
      setCurrentServer(serverId);
      router.replace(Routes.main);
    },
    [setCurrentServer, router],
  );

  const handleLongPress = useCallback(
    (serverId: string, e: GestureResponderEvent) => {
      if (Platform.OS === "web") {
        setContextMenu({ serverId, x: e.nativeEvent.pageX, y: e.nativeEvent.pageY });
        return;
      }
      const buttons: { text: string; style?: "cancel" | "destructive"; onPress?: () => void }[] = [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: () => removeServer(serverId),
        },
      ];
      if (users[serverId]) {
        buttons.push({
          text: "Settings",
          onPress: () => router.push(Routes.settings),
        });
      }
      Alert.alert("Server Options", "What would you like to do?", buttons);
    },
    [removeServer, router, users],
  );

  const handleContextMenu = useCallback((serverId: string, position: { x: number; y: number }) => {
    setContextMenu({ serverId, ...position });
  }, []);

  const handleAddServer = useCallback(() => {
    router.push(Routes.addServer);
  }, [router]);

  const closeMenu = useCallback(() => setContextMenu(null), []);

  const handleMenuSettings = useCallback(() => {
    setContextMenu(null);
    router.push(Routes.settings);
  }, [router]);

  const handleMenuDisconnect = useCallback(async () => {
    if (!contextMenu) return;
    const { serverId } = contextMenu;
    setContextMenu(null);
    const confirmed = await confirmAsync("Disconnect", "Are you sure you want to disconnect from this server?");
    if (confirmed) {
      removeServer(serverId);
    }
  }, [contextMenu, removeServer]);

  return (
    <View style={[styles.container, { backgroundColor: colors.serverSidebar }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {servers.map((server) => (
          <ServerIcon
            key={server.id}
            id={server.id}
            name={server.name ?? server.baseUrl}
            isActive={server.id === currentServerId}
            onPress={handleSelect}
            onLongPress={handleLongPress}
            onContextMenu={handleContextMenu}
          />
        ))}
      </ScrollView>
      <Pressable
        style={styles.addButton}
        onPress={handleAddServer}
        accessibilityRole="button"
        accessibilityLabel="Add server"
      >
        <Text style={styles.addButtonText}>+</Text>
      </Pressable>
      {contextMenu && (
        <ServerContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          showSettings={!!users[contextMenu.serverId]}
          onSettings={handleMenuSettings}
          onDisconnect={handleMenuDisconnect}
          onClose={closeMenu}
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    height: "100%",
    width: SERVER_SIDEBAR_WIDTH,
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 12,
  },
  scroll: {
    alignItems: "center",
    flexGrow: 1,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: SemanticColors.subtleOverlay,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  addButtonText: {
    color: SemanticColors.success,
    fontSize: 24,
    fontWeight: "600",
  },
});
