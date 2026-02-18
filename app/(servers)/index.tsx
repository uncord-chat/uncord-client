import { useRouter } from "expo-router";
import { Pressable, StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Routes } from "@/constants/routes";
import { SemanticColors } from "@/constants/theme";

export default function ServerListScreen(): React.ReactElement {
  const router = useRouter();

  const handleAddServer = () => {
    router.push(Routes.addServer);
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Add a server
      </ThemedText>
      <ThemedText style={styles.subtitle}>
        Connect to an Uncord server to get started. You can add multiple servers and switch between them.
      </ThemedText>
      <Pressable
        style={styles.primaryButton}
        onPress={handleAddServer}
        accessibilityRole="button"
        accessibilityLabel="Add server"
      >
        <ThemedText style={styles.primaryButtonText}>Add server</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  title: {
    marginBottom: 8,
  },
  subtitle: {
    marginBottom: 24,
    opacity: 0.9,
  },
  primaryButton: {
    backgroundColor: SemanticColors.primaryButtonBg,
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  primaryButtonText: {
    color: SemanticColors.primaryButtonText,
    fontWeight: "600",
  },
});
