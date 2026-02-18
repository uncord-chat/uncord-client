import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput } from "react-native";

import { ServerInfoCard } from "@/components/auth-panel/server-info-card";
import { ThemedText } from "@/components/themed-text";
import { Colors, SemanticColors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuthActions, useAuthState } from "@/lib/auth/auth-context";

type LoginFormProps = {
  serverName: string | null;
  serverDescription: string | null;
  serverIconKey: string | null;
  serverBaseUrl: string | null;
  onRegisterPress: () => void;
  onMfaRequired: () => void;
};

export function LoginForm({
  serverName,
  serverDescription,
  serverIconKey,
  serverBaseUrl,
  onRegisterPress,
  onMfaRequired,
}: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { currentServerId } = useAuthState();
  const { login } = useAuthActions();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const passwordRef = useRef<TextInput>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!currentServerId) {
      setError("No server selected.");
      return;
    }
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }
    setLoading(true);
    const result = await login(currentServerId, { email: email.trim(), password });
    setLoading(false);
    if ("error" in result) {
      setError(result.error.message);
      return;
    }
    if ("mfaRequired" in result && result.mfaRequired) {
      onMfaRequired();
    }
    // On success the layout reacts to the user appearing in auth state
  };

  const inputStyle = useMemo(
    () => [
      styles.input,
      { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.inputBorder },
    ],
    [colors.text, colors.inputBackground, colors.inputBorder],
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.form}>
      <ThemedText type="title" style={styles.title}>
        Log in
      </ThemedText>

      {serverName ? (
        <ServerInfoCard
          serverName={serverName}
          serverDescription={serverDescription}
          serverIconKey={serverIconKey}
          serverBaseUrl={serverBaseUrl}
        />
      ) : null}

      <TextInput
        style={inputStyle}
        placeholder="Email"
        placeholderTextColor={colors.icon}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        editable={!loading}
        accessibilityLabel="Email address"
        accessibilityHint="Enter your email to log in"
      />
      <TextInput
        ref={passwordRef}
        style={inputStyle}
        placeholder="Password"
        placeholderTextColor={colors.icon}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        returnKeyType="go"
        onSubmitEditing={handleSubmit}
        editable={!loading}
        accessibilityLabel="Password"
        accessibilityHint="Enter your password to log in"
      />

      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

      <Pressable
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="Log in"
      >
        {loading ? (
          <ActivityIndicator color={SemanticColors.primaryButtonText} />
        ) : (
          <ThemedText style={styles.buttonText}>Log in</ThemedText>
        )}
      </Pressable>

      <Pressable
        style={styles.link}
        onPress={onRegisterPress}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="Create an account"
      >
        <ThemedText type="link">Create an account</ThemedText>
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
    marginBottom: 24,
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
  link: {
    marginTop: 24,
    alignItems: "center",
  },
});
