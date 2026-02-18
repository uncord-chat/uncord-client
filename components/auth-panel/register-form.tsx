import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput } from "react-native";

import { ServerInfoCard } from "@/components/auth-panel/server-info-card";
import { ThemedText } from "@/components/themed-text";
import { Colors, SemanticColors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuthActions, useAuthState } from "@/lib/auth/auth-context";

type RegisterFormProps = {
  serverName: string | null;
  serverDescription: string | null;
  serverIconKey: string | null;
  serverBaseUrl: string | null;
  onLoginPress: () => void;
};

export function RegisterForm({
  serverName,
  serverDescription,
  serverIconKey,
  serverBaseUrl,
  onLoginPress,
}: RegisterFormProps) {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { currentServerId } = useAuthState();
  const { register } = useAuthActions();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const usernameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!currentServerId) {
      setError("No server selected.");
      return;
    }
    if (!email.trim() || !username.trim() || !password) {
      setError("Email, username and password are required.");
      return;
    }
    setLoading(true);
    const err = await register(currentServerId, {
      email: email.trim(),
      username: username.trim(),
      password,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
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
        Create account
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
        onSubmitEditing={() => usernameRef.current?.focus()}
        editable={!loading}
        accessibilityLabel="Email address"
        accessibilityHint="Enter your email to create an account"
      />
      <TextInput
        ref={usernameRef}
        style={inputStyle}
        placeholder="Username"
        placeholderTextColor={colors.icon}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        editable={!loading}
        accessibilityLabel="Username"
        accessibilityHint="Choose a display name for your account"
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
        accessibilityHint="Choose a secure password"
      />

      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

      <Pressable
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="Create account"
      >
        {loading ? (
          <ActivityIndicator color={SemanticColors.primaryButtonText} />
        ) : (
          <ThemedText style={styles.buttonText}>Create account</ThemedText>
        )}
      </Pressable>

      <Pressable
        style={styles.link}
        onPress={onLoginPress}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="Already have an account? Log in"
      >
        <ThemedText type="link">Already have an account? Log in</ThemedText>
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
