import { Image, StyleSheet, View } from "react-native";

import { Avatar } from "@/components/common/avatar";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

type ServerInfoCardProps = {
  serverName: string;
  serverDescription: string | null;
  serverIconKey: string | null;
  serverBaseUrl: string | null;
};

export function ServerInfoCard({ serverName, serverDescription, serverIconKey, serverBaseUrl }: ServerInfoCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  return (
    <View style={[styles.serverInfo, { borderColor: colors.inputBorder }]}>
      {serverIconKey && serverBaseUrl ? (
        <Image
          source={{ uri: `${serverBaseUrl}/api/v1/assets/${serverIconKey}` }}
          style={styles.serverIcon}
          accessibilityLabel={`${serverName} icon`}
        />
      ) : (
        <Avatar name={serverName} size={40} />
      )}
      <View style={styles.serverTextContainer}>
        <ThemedText style={styles.serverName}>{serverName}</ThemedText>
        {serverDescription ? (
          <ThemedText style={[styles.serverDescription, { color: colors.icon }]}>{serverDescription}</ThemedText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  serverInfo: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  serverIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  serverTextContainer: {
    flex: 1,
  },
  serverName: {
    fontWeight: "600",
  },
  serverDescription: {
    fontSize: 13,
    marginTop: 2,
  },
});
