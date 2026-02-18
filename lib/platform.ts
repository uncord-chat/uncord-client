/**
 * Platform-safe confirmation dialog. Uses window.confirm on web and
 * Alert.alert on native.
 */

import { Alert, Platform } from "react-native";

export function confirmAsync(title: string, message: string): Promise<boolean> {
  if (Platform.OS === "web") {
    // eslint-disable-next-line no-restricted-globals
    return Promise.resolve(confirm(message));
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "OK", style: "destructive", onPress: () => resolve(true) },
    ]);
  });
}
