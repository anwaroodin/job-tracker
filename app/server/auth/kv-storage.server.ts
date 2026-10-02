import type { BetterAuthOptions } from "better-auth";

type SecondaryStorage = NonNullable<BetterAuthOptions["secondaryStorage"]>;

const KV_MIN_TTL_SECONDS = 60;

export function kvStorage(kv: KVNamespace): SecondaryStorage {
  const put = (key: string, value: string, ttl?: number) =>
    kv.put(key, value, ttl ? { expirationTtl: Math.max(KV_MIN_TTL_SECONDS, Math.ceil(ttl)) } : undefined);
  return {
    get: (key) => kv.get(key),
    set: put,
    delete: (key) => kv.delete(key),
    getAndDelete: async (key) => {
      const value = await kv.get(key);
      if (value !== null) await kv.delete(key);
      return value;
    },
    increment: async (key, ttl) => {
      const next = Number((await kv.get(key)) ?? 0) + 1;
      await put(key, String(next), ttl);
      return next;
    },
  };
}
