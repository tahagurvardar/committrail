import { execFileSync } from "node:child_process";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

const testUrl = new URL(required("TEST_DATABASE_URL"));
const developmentUrl = process.env.DATABASE_URL?.trim();
const databaseIdentity = `${testUrl.pathname}${testUrl.searchParams.get("schema") ?? ""}`;

if (!/test/i.test(databaseIdentity)) {
  throw new Error("TEST_DATABASE_URL must identify a test database or schema.");
}
if (developmentUrl && developmentUrl === testUrl.toString()) {
  throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL.");
}

execFileSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: testUrl.toString() },
  },
);
