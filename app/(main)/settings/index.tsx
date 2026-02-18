import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { DEFAULT_TIMEOUT_MS } from "@/constants/config";
import { Routes } from "@/constants/routes";
import { Colors, SemanticColors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { deleteAccount as apiDeleteAccount } from "@/lib/api/client";
import { getValidToken } from "@/lib/api/fetch-with-refresh";
import { useAuthActions, useAuthState, useCurrentServer, useCurrentUser } from "@/lib/auth/auth-context";
import { confirmAsync } from "@/lib/platform";
import { useServerDataState } from "@/lib/server-data/server-data-context";

export default function SettingsScreen(): React.ReactElement {
  const { currentServerId } = useAuthState();
  const { logout, removeServer, refreshSession } = useAuthActions();
  const currentServer = useCurrentServer();
  const currentUser = useCurrentUser();
  const { serverConfig } = useServerDataState();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const [deletePassword, setDeletePassword] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [disconnectLoading, setDisconnectLoading] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);

  const handleLogout = async () => {
    if (!currentServerId) return;
    setLogoutLoading(true);
    setLogoutError(null);
    try {
      await Promise.race([
        logout(currentServerId),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Operation timed out.")), DEFAULT_TIMEOUT_MS)),
      ]);
      router.replace(Routes.main);
    } catch (e) {
      setLogoutError(e instanceof Error ? e.message : "Failed to log out.");
    } finally {
      setLogoutLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!currentServerId) return;
    const confirmed = await confirmAsync(
      "Disconnect",
      "Disconnect from this server? Your account will remain on the server.",
    );
    if (!confirmed) return;
    setDisconnectLoading(true);
    setDisconnectError(null);
    try {
      await Promise.race([
        removeServer(currentServerId),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Operation timed out.")), DEFAULT_TIMEOUT_MS)),
      ]);
      router.replace(Routes.main);
    } catch (e) {
      setDisconnectError(e instanceof Error ? e.message : "Failed to disconnect.");
    } finally {
      setDisconnectLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!currentServerId || !currentServer) return;
    if (!deletePassword.trim()) {
      setDeleteError("Password is required.");
      return;
    }

    const confirmed = await confirmAsync(
      "Delete Account",
      "This will permanently delete your account. This cannot be undone. Continue?",
    );
    if (!confirmed) return;

    setDeleteLoading(true);
    setDeleteError(null);

    try {
      const token = await getValidToken(currentServerId, refreshSession);
      if (!token) {
        setDeleteError("Not authenticated.");
        return;
      }
      const result = await apiDeleteAccount(currentServer.baseUrl, token, { password: deletePassword });
      if (!result.ok) {
        setDeleteError(result.message);
        return;
      }
      await removeServer(currentServerId);
      router.replace(Routes.main);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Failed to delete account.");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <ThemedText type="title" style={styles.title}>
            Settings
          </ThemedText>

          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Account
          </ThemedText>
          <ThemedText style={styles.label}>
            Logged in as {currentUser?.display_name ?? currentUser?.username ?? "unknown"}
          </ThemedText>
          <ThemedText style={styles.label}>
            Server: {serverConfig?.name ?? currentServer?.baseUrl ?? "unknown"}
          </ThemedText>

          <Pressable
            style={[styles.button, logoutLoading && styles.buttonDisabled]}
            onPress={handleLogout}
            disabled={logoutLoading}
          >
            {logoutLoading ? (
              <ActivityIndicator color={SemanticColors.primaryButtonText} />
            ) : (
              <ThemedText style={styles.buttonText}>Log out</ThemedText>
            )}
          </Pressable>
          {logoutError ? <ThemedText style={styles.error}>{logoutError}</ThemedText> : null}

          <Pressable
            style={[styles.button, styles.warningButton, disconnectLoading && styles.buttonDisabled]}
            onPress={handleDisconnect}
            disabled={disconnectLoading}
          >
            {disconnectLoading ? (
              <ActivityIndicator color={SemanticColors.primaryButtonText} />
            ) : (
              <ThemedText style={styles.buttonText}>Disconnect from server</ThemedText>
            )}
          </Pressable>
          {disconnectError ? <ThemedText style={styles.error}>{disconnectError}</ThemedText> : null}

          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Delete account
          </ThemedText>
          <ThemedText style={styles.label}>Enter your password to permanently delete your account.</ThemedText>
          <TextInput
            style={[
              styles.input,
              { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.inputBorder },
            ]}
            placeholder="Password"
            placeholderTextColor={colors.icon}
            value={deletePassword}
            onChangeText={setDeletePassword}
            secureTextEntry
            editable={!deleteLoading}
          />
          {deleteError ? <ThemedText style={styles.error}>{deleteError}</ThemedText> : null}
          <Pressable
            style={[styles.button, styles.dangerButton, deleteLoading && styles.buttonDisabled]}
            onPress={handleDeleteAccount}
            disabled={deleteLoading}
          >
            {deleteLoading ? (
              <ActivityIndicator color={SemanticColors.onDangerText} />
            ) : (
              <ThemedText style={styles.dangerButtonText}>Delete account</ThemedText>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  title: {
    marginBottom: 24,
  },
  sectionTitle: {
    marginTop: 24,
    marginBottom: 8,
  },
  label: {
    marginBottom: 8,
    opacity: 0.9,
  },
  button: {
    backgroundColor: SemanticColors.primaryButtonBg,
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 12,
  },
  warningButton: {
    backgroundColor: SemanticColors.warning,
  },
  dangerButton: {
    backgroundColor: SemanticColors.danger,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: SemanticColors.primaryButtonText,
    fontWeight: "600",
  },
  dangerButtonText: {
    color: SemanticColors.onDangerText,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    fontSize: 16,
  },
  error: {
    color: SemanticColors.error,
    marginBottom: 8,
  },
});
