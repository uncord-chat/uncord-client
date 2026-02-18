import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/common/avatar";
import { PresenceDot, type PresenceStatus } from "@/components/common/presence-dot";
import { Colors, Opacity, SidebarColors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

type MemberListItemProps = {
  /** Not rendered, but participates in memo() shallow comparison for list identity. */
  userId: string;
  name: string;
  status: PresenceStatus;
};

export const MemberListItem = memo(function MemberListItem({ userId: _userId, name, status }: MemberListItemProps) {
  const scheme = useColorScheme();
  const textColor = Colors[scheme].text;
  const sidebarBg = SidebarColors[scheme].memberSidebar;
  const isOffline = status === "offline";

  return (
    <View style={[styles.container, isOffline && styles.offline]}>
      <View style={styles.avatarWrapper}>
        <Avatar name={name} size={32} />
        <View style={styles.dotPosition}>
          <PresenceDot status={status} size={14} borderColor={sidebarBg} />
        </View>
      </View>
      <Text style={[styles.name, { color: textColor }, isOffline && styles.dimmedText]} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 12,
    borderRadius: 4,
  },
  offline: {
    opacity: Opacity.disabled,
  },
  avatarWrapper: {
    position: "relative",
  },
  dotPosition: {
    position: "absolute",
    bottom: -1,
    right: -1,
  },
  name: {
    flex: 1,
    fontSize: 14,
  },
  dimmedText: {
    opacity: Opacity.dimmed,
  },
});
