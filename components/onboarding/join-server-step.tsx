import { memo, useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Colors, SemanticColors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useCurrentServer } from "@/lib/auth/auth-context";
import { useOnboardingActions, useOnboardingState } from "@/lib/onboarding/onboarding-context";

export const JoinServerStep = memo(function JoinServerStep() {
  const { config, error: contextError } = useOnboardingState();
  const { joinServer, joinWithInvite } = useOnboardingActions();
  const currentServer = useCurrentServer();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const [inviteCode, setInviteCode] = useState("");
  const isOpenJoin = config?.open_join ?? false;
  const [loading, setLoading] = useState(isOpenJoin);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      await joinServer();
    } catch {
      setError("Failed to join server.");
    } finally {
      setLoading(false);
    }
  }, [joinServer]);

  // Auto-join for public servers — no manual button click needed.
  const autoJoinAttempted = useRef(false);
  useEffect(() => {
    if (isOpenJoin && !autoJoinAttempted.current) {
      autoJoinAttempted.current = true;
      handleJoin();
    }
  }, [isOpenJoin, handleJoin]);

  const handleInviteJoin = useCallback(async () => {
    const code = inviteCode.trim();
    if (!code) {
      setError("Please enter an invite code.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await joinWithInvite(code);
    } catch {
      setError("Failed to join with invite.");
    } finally {
      setLoading(false);
    }
  }, [inviteCode, joinWithInvite]);

  const displayError = error || contextError;

  if (isOpenJoin) {
    return (
      <View style={styles.container}>
        {loading ? (
          <View style={styles.autoJoinContainer}>
            <ActivityIndicator size="large" color={SemanticColors.primaryButtonBg} />
            <ThemedText style={styles.autoJoinText}>Joining {currentServer?.name ?? "server"}...</ThemedText>
          </View>
        ) : displayError ? (
          <View style={styles.autoJoinContainer}>
            <ThemedText style={styles.error}>{displayError}</ThemedText>
            <Pressable style={styles.button} onPress={handleJoin} accessibilityRole="button" accessibilityLabel="Retry">
              <ThemedText style={styles.buttonText}>Retry</ThemedText>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Join {currentServer?.name ?? "the server"}
      </ThemedText>

      <View style={styles.badgeRow}>
        <View style={[styles.badge, styles.badgeInvite]}>
          <ThemedText style={[styles.badgeText, styles.badgeTextInvite]}>Invite Only</ThemedText>
        </View>
      </View>

      <ThemedText style={styles.description}>
        This server requires an invite to join. Enter your invite code below.
      </ThemedText>

      <TextInput
        style={[
          styles.input,
          { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.inputBorder },
        ]}
        placeholder="Invite code"
        placeholderTextColor={colors.icon}
        value={inviteCode}
        onChangeText={setInviteCode}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="go"
        onSubmitEditing={handleInviteJoin}
        editable={!loading}
        accessibilityLabel="Invite code"
        accessibilityHint="Enter the server invite code to join"
      />

      {displayError ? <ThemedText style={styles.error}>{displayError}</ThemedText> : null}

      <Pressable
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleInviteJoin}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="Join with Invite"
      >
        {loading ? (
          <ActivityIndicator color={SemanticColors.primaryButtonText} />
        ) : (
          <ThemedText style={styles.buttonText}>Join with Invite</ThemedText>
        )}
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
  },
  autoJoinContainer: {
    alignItems: "center",
    paddingVertical: 32,
  },
  autoJoinText: {
    marginTop: 16,
    fontSize: 16,
  },
  title: {
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeOpen: {
    backgroundColor: SemanticColors.successBadgeBg,
  },
  badgeInvite: {
    backgroundColor: SemanticColors.warningBadgeBg,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  badgeTextOpen: {
    color: SemanticColors.success,
  },
  badgeTextInvite: {
    color: SemanticColors.warning,
  },
  description: {
    marginBottom: 24,
    lineHeight: 22,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  error: {
    color: SemanticColors.error,
    marginBottom: 16,
  },
  button: {
    backgroundColor: SemanticColors.primaryButtonBg,
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: SemanticColors.primaryButtonText,
    fontWeight: "600",
  },
});
