import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { ErrorBoundary } from "@/components/error-boundary";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { AuthProvider } from "@/lib/auth/auth-context";

export const unstable_settings = {
  anchor: "(main)",
};

export default function RootLayout(): React.ReactElement {
  const colorScheme = useColorScheme();

  return (
    <ErrorBoundary style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <AuthProvider>
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(servers)" options={{ headerShown: false }} />
            <Stack.Screen name="(main)" options={{ headerShown: false }} />
          </Stack>
          <StatusBar style="auto" />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
