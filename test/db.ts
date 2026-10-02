import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import type { Db } from "~/server/db/client.server";
import * as schema from "~/server/db/schema";

const MIGRATIONS = "migrations";

export const USER_ID = "user-1";

export function testDb() {
  const sqlite = new DatabaseSync(":memory:");
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    for (const statement of readFileSync(`${MIGRATIONS}/${file}`, "utf8").split("--> statement-breakpoint")) {
      if (statement.trim()) sqlite.exec(statement);
    }
  }
  sqlite
    .prepare("insert into user (id, name, email, email_verified, created_at, updated_at) values (?, ?, ?, 0, 0, 0)")
    .run(USER_ID, "Test", "test@example.com");

  const run = (sql: string, params: unknown[], method: string) => {
    const statement = sqlite.prepare(sql);
    const values = params as SQLInputValue[];
    if (method === "run") {
      statement.run(...values);
      return { rows: [] };
    }
    statement.setReturnArrays(true);
    return { rows: method === "get" ? statement.get(...values) : statement.all(...values) };
  };

  const db = drizzle(
    async (sql, params, method) => run(sql, params, method) as { rows: unknown[] },
    async (queries) => queries.map((q) => run(q.sql, q.params, q.method) as { rows: unknown[] }),
    { schema, casing: "snake_case" },
  );
  return { db: db as unknown as Db, sqlite };
}
