/** Format an ISO timestamp for display in message headers. */
export function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    if (isToday) return `Today at ${time}`;
    return `${d.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "numeric" })} ${time}`;
  } catch {
    return iso;
  }
}
