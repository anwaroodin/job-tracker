import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./app/server/db/schema.ts",
  out: "./migrations",
  casing: "snake_case",
});
