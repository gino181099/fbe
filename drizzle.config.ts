import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit no lee .env.local solo (Next sí).
config({ path: ".env.local", quiet: true });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
