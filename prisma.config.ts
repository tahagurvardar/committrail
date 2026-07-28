import "dotenv/config";

import { defineConfig, env } from "prisma/config";

const databaseUrl = process.env.DATABASE_URL?.trim();
const publicDemoWithoutDatabase =
  process.env.APP_MODE === "public-demo" && !databaseUrl;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  ...(publicDemoWithoutDatabase
    ? {}
    : { datasource: { url: databaseUrl ?? env("DATABASE_URL") } }),
});
