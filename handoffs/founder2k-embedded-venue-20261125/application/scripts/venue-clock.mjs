// Run beside the SFU under a process supervisor. Re-check even if every browser sleeps.
import { setTimeout as delay } from "node:timers/promises";
const { VENUE_CLOCK_KEY, VENUE_SITE_URL } = process.env;
if (!VENUE_CLOCK_KEY || !VENUE_SITE_URL)
  throw Error("Configure VENUE_CLOCK_KEY and VENUE_SITE_URL.");
const endpoint = new URL("/api/venue/maintenance", VENUE_SITE_URL);
for (;;) {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: "Bearer " + VENUE_CLOCK_KEY },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok)
      console.error("Conference deadline check failed", response.status);
  } catch {
    console.error("Conference deadline service unreachable");
  }
  await delay(500);
}
