import { Platform } from "react-native";
import type { TextInput } from "react-native";

/**
 * In React Native Web 0.21.x the TextInput ref resolves directly to the
 * underlying HTMLTextAreaElement.  This helper centralises the cast so that
 * the `as unknown as` pattern doesn't leak into component code.
 *
 * Returns `null` on non-web platforms or when the ref is empty.
 */
export function getWebTextArea(ref: React.RefObject<TextInput | null>): HTMLTextAreaElement | null {
  if (Platform.OS !== "web" || !ref.current) return null;
  return ref.current as unknown as HTMLTextAreaElement;
}
