import { ActivityIndicator, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useServerDataState } from "@/lib/server-data/server-data-context";

export default function MainWelcomeScreen(): React.ReactElement {
  const { serverConfig, channelsLoading } = useServerDataState();
  const colorScheme = useColorScheme();

  if (channelsLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
      </View>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        {serverConfig?.name ?? "Welcome"}
      </ThemedText>
      {serverConfig?.description ? (
        <ThemedText style={styles.description}>{serverConfig.description}</ThemedText>
      ) : null}
      <ThemedText style={styles.hint}>Select a channel to start chatting</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    marginBottom: 8,
    textAlign: "center",
  },
  description: {
    marginBottom: 24,
    textAlign: "center",
    opacity: 0.8,
  },
  hint: {
    opacity: 0.5,
    textAlign: "center",
  },
});
