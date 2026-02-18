import type { ReactNode } from "react";
import { Platform, Pressable, type ViewStyle, StyleSheet, Text, View } from "react-native";

import { ZIndex } from "@/constants/layout";
import { SemanticColors } from "@/constants/theme";

type ServerContextMenuProps = {
  x: number;
  y: number;
  showSettings?: boolean;
  onSettings: () => void;
  onDisconnect: () => void;
  onClose: () => void;
};

// Web uses position: "fixed" which isn't in RN's ViewStyle type.
const fixedPosition: ViewStyle =
  Platform.OS === "web" ? ({ position: "fixed" } as ViewStyle) : { position: "absolute" };

/** On web, render children into document.body to escape parent overflow clipping. */
function Portal({ children }: { children: ReactNode }) {
  if (Platform.OS !== "web") return <>{children}</>;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createPortal } = require("react-dom") as {
    createPortal: (children: ReactNode, container: Element) => ReactNode;
  };
  return <>{createPortal(children, document.body)}</>;
}

export function ServerContextMenu({ x, y, showSettings, onSettings, onDisconnect, onClose }: ServerContextMenuProps) {
  return (
    <Portal>
      <Pressable
        style={[styles.backdrop, fixedPosition]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close context menu"
      >
        <View style={[styles.menu, fixedPosition, { left: x, top: y }]} accessibilityRole="menu">
          {showSettings && (
            <>
              <Pressable
                style={styles.item}
                onPress={onSettings}
                accessibilityRole="menuitem"
                accessibilityLabel="Settings"
              >
                <Text style={styles.itemText}>Settings</Text>
              </Pressable>
              <View style={styles.separator} />
            </>
          )}
          <Pressable
            style={styles.item}
            onPress={onDisconnect}
            accessibilityRole="menuitem"
            accessibilityLabel="Disconnect from server"
          >
            <Text style={[styles.itemText, styles.destructiveText]}>Disconnect</Text>
          </Pressable>
        </View>
      </Pressable>
    </Portal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: ZIndex.contextMenu,
  },
  menu: {
    backgroundColor: SemanticColors.menuBg,
    borderRadius: 8,
    paddingVertical: 4,
    minWidth: 160,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: SemanticColors.menuBorder,
    zIndex: ZIndex.contextMenu,
  },
  item: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  itemText: {
    color: SemanticColors.menuText,
    fontSize: 14,
  },
  separator: {
    height: 1,
    backgroundColor: SemanticColors.menuBorder,
    marginVertical: 2,
  },
  destructiveText: {
    color: SemanticColors.danger,
  },
});
