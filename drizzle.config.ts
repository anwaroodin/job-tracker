import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./app/server/db/schema/index.ts",
  out: "./migrations",
  casing: "snake_case",
});
