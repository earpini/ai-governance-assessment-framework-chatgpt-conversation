const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-07" -> "July 2026" for headers and eyebrows */
export function snapMonth(snapshot: string): string {
  const [y, m] = snapshot.split("-");
  const name = MONTHS[Number(m) - 1];
  return name ? `${name} ${y}` : snapshot;
}
