import { useWindowDimensions } from "react-native";

import { DESKTOP_BREAKPOINT } from "@/constants/layout";

export function useIsDesktop(): boolean {
  const { width } = useWindowDimensions();
  return width >= DESKTOP_BREAKPOINT;
}
