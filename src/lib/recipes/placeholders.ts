/** Deterministic CSS gradient keyed by dish title hash. */
export function placeholderGradient(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue1 = Math.abs(hash % 360);
  const hue2 = (hue1 + 87) % 360;
  return `linear-gradient(135deg, hsl(${hue1} 70% 45%), hsl(${hue2} 80% 35%))`;
}
