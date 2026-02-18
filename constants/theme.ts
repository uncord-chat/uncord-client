/**
 * Uncord brand colours aligned with https://uncord.chat/
 * Site uses gradient backgrounds and brand cyan/purple; we use solid equivalents.
 */

import { Platform } from "react-native";

/** Brand cyan from uncord.chat (gradient start) */
const brandCyan = "#00D4FF";
/** Mid blue from site gradient */
const brandBlue = "#5B8DEF";
/** Brand purple from uncord.chat */
const brandPurple = "#7C3AED";

/** Light mode: cream-to-sky gradient → warm cream background */
const tintColorLight = brandCyan;
/** Dark mode: deep blue background → cyan accent */
const tintColorDark = brandCyan;

export const Colors = {
  light: {
    text: "#11181C",
    background: "#fbf0ea",
    tint: tintColorLight,
    icon: "#5c6b73",
    tabIconDefault: "#5c6b73",
    tabIconSelected: tintColorLight,
    inputBackground: "#ffffff",
    inputBorder: "#ccc",
    border: "rgba(0,0,0,0.08)",
    messageInputBg: "#e8e1da",
  },
  dark: {
    text: "#e8ecf0",
    background: "#0c1a33",
    tint: tintColorDark,
    icon: "#8b9cb3",
    tabIconDefault: "#8b9cb3",
    tabIconSelected: tintColorDark,
    inputBackground: "#1a2944",
    inputBorder: "#2a3f5f",
    border: "rgba(255,255,255,0.06)",
    messageInputBg: "#1a2944",
  },
};

export const SidebarColors = {
  light: {
    serverSidebar: "#e2dbd4",
    channelSidebar: "#f0e9e2",
    channelActive: "rgba(0, 212, 255, 0.15)",
    channelHover: "rgba(0, 0, 0, 0.04)",
    separator: "rgba(0, 0, 0, 0.08)",
    userFooter: "#e8e1da",
    memberSidebar: "#f0e9e2",
  },
  dark: {
    serverSidebar: "#080f1e",
    channelSidebar: "#0f1d35",
    channelActive: "rgba(0, 212, 255, 0.15)",
    channelHover: "rgba(255, 255, 255, 0.04)",
    separator: "rgba(255, 255, 255, 0.06)",
    userFooter: "#0a1528",
    memberSidebar: "#0f1d35",
  },
};

/** Brand gradient colours for use in borders, accents, etc. */
export const BrandGradient = [brandCyan, brandBlue, brandPurple] as const;

/**
 * Semantic colours for buttons, errors, and status indicators.
 * Centralised here so components avoid hard-coding hex strings.
 */
export const SemanticColors = {
  /** Error text (form validation, inline errors). */
  error: "#e74c3c",
  /** Warning accent (disconnect, caution actions). */
  warning: "#F59E0B",
  /** Danger / destructive accent (delete, ban). */
  danger: "#EF4444",
  /** Positive accent (success, add). */
  success: "#10B981",
  /** Primary button background. */
  primaryButtonBg: brandCyan,
  /** Primary button text (dark on cyan). */
  primaryButtonText: "#0c1a33",
  /** Text colour on danger/dark buttons. */
  onDangerText: "#fff",
  /** Context menu / overlay background (web). */
  menuBg: "#111827",
  /** Context menu / overlay text. */
  menuText: "#e5e7eb",
  /** Context menu / overlay border. */
  menuBorder: "rgba(255, 255, 255, 0.08)",
  /** White text on coloured backgrounds (avatars, icons). */
  contrastText: "#fff",
  /** Backdrop overlay colour (modals, drawers). */
  backdrop: "#000",
  /** Semi-transparent overlay for interactive surfaces on dark backgrounds. */
  subtleOverlay: "rgba(255,255,255,0.1)",
  /** Badge background for positive/open state. */
  successBadgeBg: "rgba(16, 185, 129, 0.15)",
  /** Badge background for caution/invite state. */
  warningBadgeBg: "rgba(245, 158, 11, 0.15)",
} as const;

/** Standardised opacity values for consistent visual dimming across components. */
export const Opacity = {
  /** Offline / disabled elements. */
  disabled: 0.5,
  /** Dimmed text (secondary labels, offline names). */
  dimmed: 0.6,
  /** Subtle de-emphasis (typing indicator text, timestamps). */
  subtle: 0.7,
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "System",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
