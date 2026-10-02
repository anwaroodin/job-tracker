import { and, desc, eq, ne } from "drizzle-orm";
import type { Db } from "../client.server";
import { application } from "../schema";

export function analyticsRows(db: Db, userId: string) {
  // Saved jobs (bookmarked from the extension, not applied to) stay out of the stats.
  return db
    .select({
      id: application.id,
      company: application.company,
      role: application.role,
      status: application.status,
      cvType: application.cvType,
      appliedAt: application.appliedAt,
      updatedAt: application.updatedAt,
    })
    .from(application)
    .where(and(eq(application.userId, userId), ne(application.status, "saved")))
    .orderBy(desc(application.appliedAt), desc(application.updatedAt));
}
