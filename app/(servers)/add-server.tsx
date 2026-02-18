import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Routes } from "@/constants/routes";
import { Colors, SemanticColors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getPublicServerInfo, healthCheck } from "@/lib/api/client";
import { useAuthActions } from "@/lib/auth/auth-context";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const logoDark = require("@/assets/images/logo-dark.png") as number;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const logoLight = require("@/assets/images/logo-light.png") as number;

export default function AddServerScreen(): React.ReactElement {
  const [baseUrl, setBaseUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [serverInfo, setServerInfo] = useState<{ name: string; description: string } | null>(null);

  const { addServer } = useAuthActions();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const handleSubmit = async () => {
    setError(null);
    setServerInfo(null);
    const url = baseUrl.trim();
    if (!url) {
      setError("Please enter a server URL.");
      return;
    }
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      setError("URL must start with http:// or https://");
      return;
    }
    setLoading(true);

    try {
      const health = await healthCheck(url);
      if (!health.ok) {
        setError(health.message || "Could not reach server. Check the URL.");
        return;
      }

      const info = await getPublicServerInfo(url);
      if (info.ok) {
        setServerInfo({ name: info.data.name, description: info.data.description });
      }

      await addServer(url, info.ok ? info.data.name : undefined);
      router.replace(Routes.main);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : Platform.OS === "web" ? undefined : "height"}
        style={styles.form}
      >
        <Image
          source={colorScheme === "dark" ? logoDark : logoLight}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="Uncord logo"
        />
        <ThemedText type="title" style={styles.title}>
          Add server
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          Enter the base URL of an Uncord server (e.g. https://chat.example.com).
        </ThemedText>

        <TextInput
          style={[
            styles.input,
            { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.inputBorder },
          ]}
          placeholder="https://chat.example.com"
          placeholderTextColor={colors.icon}
          value={baseUrl}
          onChangeText={(text) => {
            setBaseUrl(text);
            setError(null);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
          editable={!loading}
        />

        {serverInfo ? (
          <View style={[styles.serverInfo, { borderColor: colors.inputBorder }]}>
            <ThemedText style={styles.serverName}>{serverInfo.name}</ThemedText>
            {serverInfo.description ? (
              <ThemedText style={styles.serverDescription}>{serverInfo.description}</ThemedText>
            ) : null}
          </View>
        ) : null}

        {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

        <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSubmit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={SemanticColors.contrastText} />
          ) : (
            <ThemedText style={styles.buttonText}>Connect</ThemedText>
          )}
        </Pressable>

        <Pressable style={styles.link} onPress={() => router.back()} disabled={loading}>
          <ThemedText type="link">Cancel</ThemedText>
        </Pressable>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  form: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
  },
  logo: {
    width: 350,
    height: 105,
    alignSelf: "center",
    marginBottom: 32,
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
    fontSize: 16,
  },
  serverInfo: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  serverName: {
    fontWeight: "600",
  },
  serverDescription: {
    marginTop: 4,
    opacity: 0.8,
    fontSize: 14,
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
