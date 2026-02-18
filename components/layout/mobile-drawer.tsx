import { useCallback, useEffect } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { CHANNEL_SIDEBAR_WIDTH, SERVER_SIDEBAR_WIDTH, ZIndex } from "@/constants/layout";
import { SemanticColors } from "@/constants/theme";

const DEFAULT_DRAWER_WIDTH = SERVER_SIDEBAR_WIDTH + CHANNEL_SIDEBAR_WIDTH;

type MobileDrawerProps = {
  open: boolean;
  onClose: () => void;
  width?: number;
  children: React.ReactNode;
};

export function MobileDrawer({ open, onClose, width = DEFAULT_DRAWER_WIDTH, children }: MobileDrawerProps) {
  const translateX = useSharedValue(-width);
  const backdropOpacity = useSharedValue(0);
  const isVisible = useSharedValue(false);

  const hideBackdrop = useCallback(() => {
    isVisible.value = false;
  }, [isVisible]);

  useEffect(() => {
    if (open) {
      isVisible.value = true;
      translateX.value = withTiming(0, { duration: 250 });
      backdropOpacity.value = withTiming(0.5, { duration: 250 });
    } else {
      translateX.value = withTiming(-width, { duration: 250 });
      backdropOpacity.value = withTiming(0, { duration: 250 }, () => {
        runOnJS(hideBackdrop)();
      });
    }
  }, [open, width, translateX, backdropOpacity, isVisible, hideBackdrop]);

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
    display: isVisible.value ? ("flex" as const) : ("none" as const),
  }));

  return (
    <>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close navigation menu"
        />
      </Animated.View>
      <Animated.View style={[styles.drawer, { width }, drawerStyle]}>{children}</Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SemanticColors.backdrop,
    zIndex: ZIndex.drawer,
  },
  drawer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    flexDirection: "row",
    zIndex: ZIndex.drawer,
  },
});
