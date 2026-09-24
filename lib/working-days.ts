// Counts Mon–Fri days strictly between `date` and `now`. No holiday
// calendar — confirmed scope for the lead-timeout feature.
//
// Uses UTC throughout (not local time) so the boundary is deterministic
// regardless of which timezone the server process happens to run in —
// local-time midnight would silently shift by a day depending on
// deployment (e.g. Vercel runs UTC, a dev machine might run IST).
export function workingDaysSince(date: Date, now: Date = new Date()): number {
  let count = 0;
  const cursor = new Date(date);
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setUTCHours(0, 0, 0, 0);

  cursor.setUTCDate(cursor.getUTCDate() + 1);
  while (cursor <= end) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) count++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}
