import { eq } from "drizzle-orm";
import type { Db } from "./client.server";
import { user } from "./schema";

export async function getUserById(db: Db, id: string) {
  const rows = await db.select().from(user).where(eq(user.id, id)).limit(1);
  return rows[0] ?? null;
}
