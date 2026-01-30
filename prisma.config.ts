import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",

  migrations: {
    path: "prisma/migrations",

    // ✅ ADD THIS LINE
    seed: "npx tsx prisma/seed.ts",
  },

  datasource: {
    // use DIRECT_URL for migrations (non-pooled)
    url: env("DIRECT_URL"),
  },
});
