// Formatting for agreement text. Hand-rolled rather than Intl so the same input
// renders the same bytes on any Node build (the PDF's hash is part of the
// signing evidence).

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT_MONTHS = MONTHS.map((m) => m.slice(0, 3));

export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}

/** "2026-10-27" → { day: "27th", month: "October", year: "2026" } */
export function effectiveDateParts(isoDate: string): { day: string; month: string; year: string } {
  const [y, m, d] = isoDate.split("-").map(Number);
  return { day: ordinal(d), month: MONTHS[m - 1], year: String(y) };
}

/** India has no daylight saving, so IST is always UTC+5:30. */
const IST_OFFSET_MS = 330 * 60 * 1000;

/** "27 Oct 2026, 4:05 pm IST" */
export function istTimestamp(at: Date): string {
  const t = new Date(at.getTime() + IST_OFFSET_MS);
  const h = t.getUTCHours();
  const mm = String(t.getUTCMinutes()).padStart(2, "0");
  return `${t.getUTCDate()} ${SHORT_MONTHS[t.getUTCMonth()]} ${t.getUTCFullYear()}, ${h % 12 || 12}:${mm} ${h < 12 ? "am" : "pm"} IST`;
}

/** IST calendar date of an instant, as YYYY-MM-DD. */
export function istDate(at: Date): string {
  return new Date(at.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Indian digit grouping: 1500000 → "15,00,000"; up to 2 decimals kept. */
export function indianNumber(n: number): string {
  const [whole, frac] = (Math.round(n * 100) / 100).toString().split(".");
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return (rest ? `${rest},${last3}` : last3) + (frac ? `.${frac}` : "");
}
