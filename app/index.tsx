import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { DEFAULT_TIMEOUT_MS } from "@/constants/config";
import { Routes } from "@/constants/routes";
import { Colors, SemanticColors } from "@/constants/theme";
import { useNeedsServerSetup } from "@/hooks/use-auth-gate";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuthActions, useAuthState } from "@/lib/auth/auth-context";

/** Gate: redirects to (servers) or (main) based on state. */
export default function GateScreen(): React.ReactElement {
  const { tokensLoaded, currentServerId } = useAuthState();
  const { refreshSession } = useAuthActions();
  const needsServerSetup = useNeedsServerSetup();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (tokensLoaded) return;
    const timer = setTimeout(() => setTimedOut(true), DEFAULT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [tokensLoaded]);

  useEffect(() => {
    if (!tokensLoaded) return;
    if (needsServerSetup) {
      router.replace(Routes.servers);
    } else {
      router.replace(Routes.main);
    }
  }, [tokensLoaded, needsServerSetup, router]);

  const handleRetry = useCallback(() => {
    setTimedOut(false);
    if (currentServerId) {
      refreshSession(currentServerId);
    }
  }, [currentServerId, refreshSession]);

  if (timedOut && !tokensLoaded) {
    return (
      <View style={styles.container}>
        <ThemedText style={styles.errorText}>Failed to load session data.</ThemedText>
        <Pressable style={styles.retryButton} onPress={handleRetry} accessibilityRole="button">
          <ThemedText style={styles.retryText}>Retry</ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    color: SemanticColors.error,
    fontSize: 16,
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: SemanticColors.primaryButtonBg,
  },
  retryText: {
    color: SemanticColors.primaryButtonText,
    fontWeight: "600",
  },
});
