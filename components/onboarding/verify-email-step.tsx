import { memo, useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Colors, SemanticColors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuthState, useCurrentUser } from "@/lib/auth/auth-context";
import { useOnboardingActions, useOnboardingState } from "@/lib/onboarding/onboarding-context";

const COOLDOWN_MS = 60_000;
const POLL_INTERVAL_MS = 5_000;

export const VerifyEmailStep = memo(function VerifyEmailStep() {
  const currentUser = useCurrentUser();
  const { currentServerId } = useAuthState();
  const { resendVerification, refreshStep } = useOnboardingActions();
  const { pendingInviteCode } = useOnboardingState();
  const colorScheme = useColorScheme();

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleResend = useCallback(async () => {
    if (cooldown || sending) return;
    setError(null);
    setSending(true);
    try {
      await resendVerification();
      setSent(true);
      setCooldown(true);
      cooldownTimerRef.current = setTimeout(() => setCooldown(false), COOLDOWN_MS);
    } catch {
      setError("Failed to send verification email.");
    } finally {
      setSending(false);
    }
  }, [cooldown, sending, resendVerification]);

  // Poll for email verification by re-checking onboarding status.
  // We intentionally do NOT call refreshSession here — getMe returns 403
  // MEMBERSHIP_REQUIRED for non-members, which clears the user from auth state.
  // The onboarding status endpoint only requires auth and is the source of truth.
  useEffect(() => {
    if (!currentServerId) return;

    pollRef.current = setInterval(async () => {
      try {
        await refreshStep();
      } catch {
        // Polling failure is non-critical; will retry on next interval
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [currentServerId, refreshStep]);

  // Cleanup cooldown timer on unmount
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    };
  }, []);

  return (
    <View style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Verify your email
      </ThemedText>

      {pendingInviteCode ? (
        <View style={[styles.infoBox, { borderColor: Colors[colorScheme].tint }]}>
          <ThemedText style={styles.infoText}>
            Your invite code has been confirmed. Verify your email address to finish joining.
          </ThemedText>
        </View>
      ) : null}

      <ThemedText style={styles.description}>
        We sent a verification email to{" "}
        <ThemedText type="defaultSemiBold">{currentUser?.email ?? "your email address"}</ThemedText>. Check your inbox
        and click the link to continue.
      </ThemedText>

      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
      {sent && !error ? <ThemedText style={styles.success}>Verification email sent!</ThemedText> : null}

      <Pressable
        style={[styles.button, (cooldown || sending) && styles.buttonDisabled]}
        onPress={handleResend}
        disabled={cooldown || sending}
        accessibilityRole="button"
        accessibilityLabel={cooldown ? "Email sent — check your inbox" : "Resend verification email"}
      >
        {sending ? (
          <ActivityIndicator color={SemanticColors.primaryButtonText} />
        ) : (
          <ThemedText style={styles.buttonText}>
            {cooldown ? "Email sent — check your inbox" : "Resend verification email"}
          </ThemedText>
        )}
      </Pressable>

      <View style={styles.pollNotice}>
        <ActivityIndicator size="small" color={Colors[colorScheme].icon} />
        <ThemedText style={styles.pollText}>Waiting for verification…</ThemedText>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
  },
  title: {
    marginBottom: 16,
  },
  infoBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  description: {
    marginBottom: 24,
    lineHeight: 22,
  },
  error: {
    color: SemanticColors.error,
    marginBottom: 16,
  },
  success: {
    color: SemanticColors.success,
    marginBottom: 16,
  },
  button: {
    backgroundColor: SemanticColors.primaryButtonBg,
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: SemanticColors.primaryButtonText,
    fontWeight: "600",
  },
  pollNotice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    gap: 8,
  },
  pollText: {
    fontSize: 13,
    opacity: 0.7,
  },
});
