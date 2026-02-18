import { useMemo, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Colors, SemanticColors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuthActions } from "@/lib/auth/auth-context";

type MfaFormProps = {
  onBackToLogin: () => void;
};

export function MfaForm({ onBackToLogin }: MfaFormProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { submitMfaCode, clearMfaTicket } = useAuthActions();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const inputStyle = useMemo(
    () => [
      styles.input,
      { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.inputBorder },
    ],
    [colors.text, colors.inputBackground, colors.inputBorder],
  );

  const handleSubmit = async () => {
    setError(null);
    const trimmed = code.trim().replace(/\s/g, "");
    if (!trimmed) {
      setError("Enter your 6-digit code.");
      return;
    }
    setLoading(true);
    const err = await submitMfaCode(trimmed);
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    // On success the layout reacts to the user appearing in auth state
  };

  const handleBack = () => {
    clearMfaTicket();
    onBackToLogin();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.form}>
      <ThemedText type="title" style={styles.title}>
        Two-factor authentication
      </ThemedText>
      <ThemedText style={styles.subtitle}>Enter the 6-digit code from your authenticator app.</ThemedText>

      <TextInput
        style={inputStyle}
        placeholder="000000"
        placeholderTextColor={colors.icon}
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        maxLength={8}
        returnKeyType="go"
        onSubmitEditing={handleSubmit}
        editable={!loading}
        accessibilityLabel="Authentication code"
        accessibilityHint="Enter the 6-digit code from your authenticator app"
      />

      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

      <Pressable
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="Verify"
      >
        {loading ? (
          <ActivityIndicator color={SemanticColors.primaryButtonText} />
        ) : (
          <ThemedText style={styles.buttonText}>Verify</ThemedText>
        )}
      </Pressable>

      <Pressable
        style={styles.link}
        onPress={handleBack}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="Back to login"
      >
        <ThemedText type="link">Back to login</ThemedText>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  form: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
  },
  title: {
    marginBottom: 8,
  },
  subtitle: {
    marginBottom: 24,
    opacity: 0.9,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 18,
    letterSpacing: 4,
    textAlign: "center",
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
  link: {
    marginTop: 24,
    alignItems: "center",
  },
});
