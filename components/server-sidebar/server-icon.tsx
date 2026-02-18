import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { type GestureResponderEvent, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { SemanticColors } from "@/constants/theme";
import { colourFromName } from "@/lib/colour";

type ServerIconProps = {
  id: string;
  name: string;
  isActive: boolean;
  onPress: (id: string) => void;
  onLongPress?: (id: string, e: GestureResponderEvent) => void;
  onContextMenu?: (id: string, position: { x: number; y: number }) => void;
};

export const ServerIcon = memo(function ServerIcon({
  id,
  name,
  isActive,
  onPress,
  onLongPress,
  onContextMenu,
}: ServerIconProps) {
  const letter = (name[0] ?? "?").toUpperCase();
  const bg = useMemo(() => colourFromName(name), [name]);
  const wrapperRef = useRef<View>(null);

  const handlePress = useCallback(() => onPress(id), [id, onPress]);
  const handleLongPress = useCallback((e: GestureResponderEvent) => onLongPress?.(id, e), [id, onLongPress]);

  useEffect(() => {
    if (Platform.OS !== "web" || !onContextMenu) return;

    const node = wrapperRef.current as unknown as HTMLElement | null;
    if (!node) return;

    const handler = (e: MouseEvent) => {
      e.preventDefault();
      onContextMenu(id, { x: e.pageX, y: e.pageY });
    };

    node.addEventListener("contextmenu", handler);
    return () => node.removeEventListener("contextmenu", handler);
  }, [id, onContextMenu]);

  return (
    <View ref={wrapperRef} style={styles.wrapper}>
      <View style={[styles.indicator, isActive && styles.indicatorActive]} />
      <Pressable
        style={[styles.icon, { backgroundColor: bg }, isActive && styles.iconActive]}
        onPress={handlePress}
        onLongPress={handleLongPress}
        accessibilityRole="button"
        accessibilityLabel={`${name} server`}
        accessibilityState={{ selected: isActive }}
      >
        <Text style={styles.letter}>{letter}</Text>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 8,
  },
  indicator: {
    width: 4,
    height: 0,
    borderRadius: 2,
    backgroundColor: SemanticColors.contrastText,
    marginRight: 6,
  },
  indicatorActive: {
    height: 32,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  iconActive: {
    borderRadius: 16,
  },
  letter: {
    color: SemanticColors.contrastText,
    fontSize: 20,
    fontWeight: "700",
  },
});
