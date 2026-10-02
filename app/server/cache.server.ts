/**
 * Read-through cache for small, read-heavy, staleness-tolerant aggregates
 * (dashboard stats, unread counts) backed by the Worker's built-in Cache API
 * — no extra bindings, KV namespaces, or servers. Entries live at the edge
 * colo that served the request and expire on their own via max-age, so a
 * missed invalidate() only costs a few seconds of staleness, never a stuck
 * value.
 *
 * Not for anything latency-sensitive or progress-tracking (e.g. live Gmail
 * sync stage) — short TTLs here are a trade against that kind of freshness.
 */

export const ANALYTICS_CACHE = "analytics";
export const UNREAD_COUNTS_CACHE = "unread-counts";

const NAMESPACE = "https://cache.job-tracker.internal";
// A named cache instead of `caches.default` — that one is reserved for real
// HTTP response caching; this is purely an internal read-through store, and
// `.open()` (unlike `.default`) type-checks under the DOM lib the client
// code in this project also needs.
const CACHE_NAME = "job-tracker-read-through";

function cacheKey(name: string, userId: string) {
  return new Request(`${NAMESPACE}/${name}/${userId}`);
}

export async function cached<T>(name: string, userId: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
  const key = cacheKey(name, userId);
  const store = await caches.open(CACHE_NAME).catch(() => null);
  const hit = await store?.match(key).catch(() => undefined);
  if (hit) return hit.json() as Promise<T>;

  const value = await compute();
  await store
    ?.put(
      key,
      new Response(JSON.stringify(value), {
        headers: { "cache-control": `max-age=${ttlSeconds}`, "content-type": "application/json" },
      }),
    )
    .catch((e) => console.error("cache put failed", name, e));
  return value;
}

export async function invalidate(name: string, userId: string) {
  try {
    const store = await caches.open(CACHE_NAME);
    await store.delete(cacheKey(name, userId));
  } catch (e) {
    console.error("cache invalidate failed", name, e);
  }
}
