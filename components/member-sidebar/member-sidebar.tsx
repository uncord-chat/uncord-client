import { memo, useCallback, useMemo } from "react";
import { ActivityIndicator, SectionList, StyleSheet, View } from "react-native";

import type { PresenceStatus } from "@/components/common/presence-dot";
import { MEMBER_SIDEBAR_WIDTH } from "@/constants/layout";
import { Colors, SidebarColors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useChannelMembers } from "@/lib/members/use-channel-members";
import { useMemberState } from "@/lib/members/member-context";
import { usePresenceState } from "@/lib/presence/presence-context";

import { MemberListItem } from "./member-list-item";
import { RoleGroupHeader } from "./role-group-header";

type MemberItem = {
  userId: string;
  name: string;
  status: PresenceStatus;
};

type MemberSection = {
  key: string;
  roleName: string;
  count: number;
  data: MemberItem[];
};

function displayName(member: {
  nickname: string | null;
  user: { display_name: string | null; username: string };
}): string {
  return member.nickname ?? member.user.display_name ?? member.user.username;
}

export const MemberSidebar = memo(function MemberSidebar({ channelId }: { channelId: string }) {
  const { channelMembers, loading } = useChannelMembers(channelId);
  const { roles } = useMemberState();
  const { presences } = usePresenceState();
  const scheme = useColorScheme();
  const colors = SidebarColors[scheme];
  const borderColor = Colors[scheme].border;

  const sections = useMemo(() => {
    // Build a role lookup — only hoisted roles form groups.
    const hoistedRoles = roles.filter((r) => r.hoist && !r.is_everyone).sort((a, b) => b.position - a.position);
    const roleMap = new Map(roles.map((r) => [r.id, r]));

    type GroupMap = Map<string, { roleName: string; position: number; members: MemberItem[] }>;

    const onlineGroupMap: GroupMap = new Map();
    const offlineGroupMap: GroupMap = new Map();

    // Pre-create groups for each hoisted role, plus a fallback for unhoisted members.
    const FALLBACK_KEY = "__members__";
    for (const role of hoistedRoles) {
      onlineGroupMap.set(role.id, { roleName: role.name, position: role.position, members: [] });
      offlineGroupMap.set(role.id, { roleName: role.name, position: role.position, members: [] });
    }
    onlineGroupMap.set(FALLBACK_KEY, { roleName: "Members", position: -1, members: [] });
    offlineGroupMap.set(FALLBACK_KEY, { roleName: "Members", position: -1, members: [] });

    for (const member of channelMembers) {
      const status = (presences.get(member.user.id) ?? "offline") as PresenceStatus;
      const name = displayName(member);
      const entry: MemberItem = { userId: member.user.id, name, status };

      // Find highest hoisted role for this member.
      let placed = false;
      if (member.roles.length > 0) {
        let highestHoisted: { id: string; position: number } | null = null;
        for (const roleId of member.roles) {
          const role = roleMap.get(roleId);
          if (role?.hoist && !role.is_everyone) {
            if (!highestHoisted || role.position > highestHoisted.position) {
              highestHoisted = { id: role.id, position: role.position };
            }
          }
        }
        if (highestHoisted) {
          const targetMap = status === "offline" ? offlineGroupMap : onlineGroupMap;
          targetMap.get(highestHoisted.id)?.members.push(entry);
          placed = true;
        }
      }

      if (!placed) {
        const targetMap = status === "offline" ? offlineGroupMap : onlineGroupMap;
        targetMap.get(FALLBACK_KEY)?.members.push(entry);
      }
    }

    // Sort members alphabetically within each group.
    const sortMembers = (groups: GroupMap) => {
      for (const group of groups.values()) {
        group.members.sort((a, b) => a.name.localeCompare(b.name));
      }
    };
    sortMembers(onlineGroupMap);
    sortMembers(offlineGroupMap);

    // Filter out empty groups and sort by position descending (highest first).
    const filterAndSort = (groups: GroupMap) =>
      Array.from(groups.values())
        .filter((g) => g.members.length > 0)
        .sort((a, b) => b.position - a.position);

    const onlineGroups = filterAndSort(onlineGroupMap);
    const offlineGroups = filterAndSort(offlineGroupMap);

    const result: MemberSection[] = [];

    // Online groups as individual sections
    for (const group of onlineGroups) {
      result.push({
        key: `online-${group.roleName}`,
        roleName: group.roleName,
        count: group.members.length,
        data: group.members,
      });
    }

    // Offline members as a single merged section
    const offlineTotal = offlineGroups.reduce((sum, g) => sum + g.members.length, 0);
    if (offlineTotal > 0) {
      const allOffline = offlineGroups.flatMap((g) => g.members);
      result.push({
        key: "offline",
        roleName: "Offline",
        count: offlineTotal,
        data: allOffline,
      });
    }

    return result;
  }, [channelMembers, roles, presences]);

  // Empty dependency arrays are correct — these callbacks only use their
  // arguments, not any captured closure variables. MemberListItem and
  // RoleGroupHeader are memoised, so a stable reference prevents re-renders.
  const renderItem = useCallback(
    ({ item }: { item: MemberItem }) => <MemberListItem userId={item.userId} name={item.name} status={item.status} />,
    [],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: MemberSection }) => <RoleGroupHeader name={section.roleName} count={section.count} />,
    [],
  );

  const keyExtractor = useCallback((item: MemberItem) => item.userId, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.channelSidebar }]}>
      <View style={[styles.header, { borderBottomColor: borderColor }]} />
      {loading && channelMembers.length === 0 && (
        <View style={styles.loading}>
          <ActivityIndicator size="small" />
        </View>
      )}
      <SectionList
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        style={styles.list}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        removeClippedSubviews
        maxToRenderPerBatch={15}
        windowSize={9}
        accessibilityRole="list"
        accessibilityLabel="Members"
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    height: "100%",
    width: MEMBER_SIDEBAR_WIDTH,
    flexDirection: "column",
  },
  header: {
    height: 48,
    borderBottomWidth: 1,
  },
  loading: {
    paddingTop: 16,
    alignItems: "center",
  },
  list: {
    flex: 1,
    paddingTop: 4,
    paddingHorizontal: 8,
  },
});
