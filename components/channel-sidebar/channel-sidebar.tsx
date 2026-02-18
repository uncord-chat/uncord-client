import { useRouter } from "expo-router";
import { memo, useCallback, useMemo, useState } from "react";
import { Pressable, SectionList, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/common/avatar";
import { CHANNEL_SIDEBAR_WIDTH } from "@/constants/layout";
import { Routes } from "@/constants/routes";
import { Colors, SidebarColors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useCurrentUser } from "@/lib/auth/auth-context";
import { useServerDataActions, useServerDataState } from "@/lib/server-data/server-data-context";

import { ChannelListItem } from "./channel-list-item";

type ChannelItem = {
  id: string;
  name: string;
};

type ChannelSection = {
  key: string;
  title: string | null;
  data: ChannelItem[];
};

function SectionHeader({ title, collapsed, onToggle }: { title: string; collapsed: boolean; onToggle: () => void }) {
  const colorScheme = useColorScheme();
  const textColor = Colors[colorScheme].icon;

  return (
    <Pressable
      style={styles.sectionHeader}
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={`${title} category`}
      accessibilityState={{ expanded: !collapsed }}
    >
      <Text
        style={[styles.arrow, { color: textColor }]}
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {collapsed ? "\u25B6" : "\u25BC"}
      </Text>
      <Text style={[styles.sectionText, { color: textColor }]}>{title.toUpperCase()}</Text>
    </Pressable>
  );
}

export const ChannelSidebar = memo(function ChannelSidebar() {
  const { serverConfig, channels, categories, currentChannelId } = useServerDataState();
  const { setCurrentChannel } = useServerDataActions();
  const currentUser = useCurrentUser();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = SidebarColors[colorScheme];
  const textColor = Colors[colorScheme].text;
  const mutedColor = Colors[colorScheme].icon;

  const [collapsedCategories, setCollapsedCategories] = useState<string[]>([]);

  const toggleCategory = useCallback((categoryId: string) => {
    setCollapsedCategories((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId],
    );
  }, []);

  const sections = useMemo(() => {
    const result: ChannelSection[] = [];

    // Uncategorised channels first
    const uncategorised = channels
      .filter((c) => !c.category_id)
      .sort((a, b) => a.position - b.position)
      .map((c) => ({ id: c.id, name: c.name }));

    if (uncategorised.length > 0) {
      result.push({ key: "__uncategorised__", title: null, data: uncategorised });
    }

    // Categorised channels
    const sortedCategories = [...categories].sort((a, b) => a.position - b.position);
    const channelsByCategory = new Map<string, ChannelItem[]>();
    for (const ch of channels) {
      if (!ch.category_id) continue;
      const list = channelsByCategory.get(ch.category_id) ?? [];
      list.push({ id: ch.id, name: ch.name });
      channelsByCategory.set(ch.category_id, list);
    }
    for (const [key, list] of channelsByCategory) {
      channelsByCategory.set(
        key,
        list.sort((a, b) => {
          const chA = channels.find((c) => c.id === a.id);
          const chB = channels.find((c) => c.id === b.id);
          return (chA?.position ?? 0) - (chB?.position ?? 0);
        }),
      );
    }

    for (const category of sortedCategories) {
      const categoryChannels = channelsByCategory.get(category.id);
      if (!categoryChannels?.length) continue;

      const isCollapsed = collapsedCategories.includes(category.id);
      result.push({
        key: category.id,
        title: category.name,
        data: isCollapsed ? [] : categoryChannels,
      });
    }

    return result;
  }, [channels, categories, collapsedCategories]);

  const handleSelectChannel = useCallback(
    (channelId: string) => {
      setCurrentChannel(channelId);
      router.push(Routes.channel(channelId));
    },
    [setCurrentChannel, router],
  );

  const handleSettings = useCallback(() => {
    router.push(Routes.settings);
  }, [router]);

  const renderItem = useCallback(
    ({ item }: { item: ChannelItem }) => (
      <ChannelListItem
        id={item.id}
        name={item.name}
        isActive={item.id === currentChannelId}
        onPress={handleSelectChannel}
      />
    ),
    [currentChannelId, handleSelectChannel],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: ChannelSection }) => {
      if (!section.title) return null;
      return (
        <SectionHeader
          title={section.title}
          collapsed={collapsedCategories.includes(section.key)}
          onToggle={() => toggleCategory(section.key)}
        />
      );
    },
    [collapsedCategories, toggleCategory],
  );

  const keyExtractor = useCallback((item: ChannelItem) => item.id, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.channelSidebar }]}>
      <View style={[styles.header, { borderBottomColor: colors.separator }]}>
        <Text style={[styles.serverName, { color: textColor }]} numberOfLines={1}>
          {serverConfig?.name ?? "Loading..."}
        </Text>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        style={styles.channelList}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        removeClippedSubviews
        maxToRenderPerBatch={15}
        windowSize={9}
        accessibilityRole="list"
        accessibilityLabel="Channels"
      />

      <View style={[styles.footer, { backgroundColor: colors.userFooter, borderTopColor: colors.separator }]}>
        <Avatar name={currentUser?.display_name ?? currentUser?.username ?? "?"} size={32} />
        <View style={styles.footerInfo}>
          <Text style={[styles.footerName, { color: textColor }]} numberOfLines={1}>
            {currentUser?.display_name ?? currentUser?.username ?? ""}
          </Text>
        </View>
        <Pressable
          style={styles.footerButton}
          onPress={handleSettings}
          accessibilityRole="button"
          accessibilityLabel="Settings"
        >
          <Text style={[styles.gearIcon, { color: mutedColor }]}>{"\u2699"}</Text>
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    height: "100%",
    width: CHANNEL_SIDEBAR_WIDTH,
    flexDirection: "column",
  },
  header: {
    height: 48,
    paddingHorizontal: 16,
    justifyContent: "center",
    borderBottomWidth: 1,
  },
  serverName: {
    fontSize: 16,
    fontWeight: "700",
  },
  channelList: {
    flex: 1,
    paddingTop: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginTop: 16,
  },
  arrow: {
    fontSize: 8,
    marginRight: 4,
  },
  sectionText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    gap: 8,
  },
  footerInfo: {
    flex: 1,
  },
  footerName: {
    fontSize: 13,
    fontWeight: "600",
  },
  footerButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
  },
  gearIcon: {
    fontSize: 16,
  },
});
