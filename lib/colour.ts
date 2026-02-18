const PALETTE = ["#5B8DEF", "#7C3AED", "#00D4FF", "#F59E0B", "#EF4444", "#10B981", "#EC4899", "#8B5CF6"] as const;

export function colourFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length]!;
}
