/** Breakpoint in logical pixels below which mobile layout is used. */
export const DESKTOP_BREAKPOINT = 768;

/** Width of the server icon sidebar in logical pixels. */
export const SERVER_SIDEBAR_WIDTH = 72;

/** Width of the channel list sidebar in logical pixels. */
export const CHANNEL_SIDEBAR_WIDTH = 240;

/** Width of the member list sidebar in logical pixels. */
export const MEMBER_SIDEBAR_WIDTH = 240;

/**
 * Vertical offset for KeyboardAvoidingView on iOS to account for the
 * navigation header and safe area. This value works across standard iPhone
 * and iPad layouts; adjust if a custom header height is introduced.
 */
export const IOS_KEYBOARD_VERTICAL_OFFSET = 90;

/** Standardised spacing scale in logical pixels. */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

/** Standardised z-index scale for overlapping elements. */
export const ZIndex = {
  dropdown: 1000,
  drawer: 1500,
  modal: 2000,
  contextMenu: 3000,
  tooltip: 4000,
} as const;
