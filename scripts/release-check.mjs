import { existsSync, readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const required = [
  "LICENSE",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md",
  "CHANGELOG.md",
  "docs/release-checklist.md",
  "docs/release-notes-v1.0.0.md",
  "docs/operations.md",
  "docs/accessibility.md",
  "docs/deployment.md",
];
const failures = [];
const read = (file) => readFileSync(path.join(root, file), "utf8");
const pkg = JSON.parse(read("package.json"));
const lock = JSON.parse(read("package-lock.json"));

if (pkg.version !== "1.0.0") failures.push("package version");
if (lock.version !== "1.0.0" || lock.packages?.[""]?.version !== "1.0.0")
  failures.push("lockfile version");
if (pkg.engines?.node !== ">=22 <25") failures.push("Node engine");
for (const file of required)
  if (!existsSync(path.join(root, file))) failures.push(file);
if (!read("CHANGELOG.md").includes("1.0.0")) failures.push("changelog entry");
if (readdirSync(path.join(root, "prisma", "migrations")).length === 0)
  failures.push("migrations");

const tracked = new Set(
  execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .split(/\r?\n/)
    .filter(Boolean),
);
const prohibited = [
  /\b(Co-Authored-By|AI-generated|ChatGPT|Anthropic|Claude)\b/i,
  /AKIA[0-9A-Z]{16}/,
  /gh[pousr]_[A-Za-z0-9_]{20,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];
for (const file of [
  "README.md",
  ...required.filter((item) => item.endsWith(".md")),
]) {
  if (!existsSync(path.join(root, file))) continue;
  const content = read(file);
  if (prohibited.some((pattern) => pattern.test(content)))
    failures.push(`prohibited content in ${file}`);
}

const screenshots = [
  "docs/assets/screenshots/landing.png",
  "docs/assets/screenshots/demo.png",
  "docs/assets/screenshots/public-profile.png",
  "docs/assets/screenshots/public-project.png",
  "docs/assets/screenshots/dashboard.png",
];
for (const screenshot of screenshots)
  if (!existsSync(path.join(root, screenshot))) failures.push(screenshot);
if (tracked.has(".env") || tracked.has(".env.local"))
  failures.push("committed environment file");
for (const artifact of [
  ".next",
  "test-results",
  "playwright-report",
  "blob-report",
  "coverage",
]) {
  if (
    [...tracked].some(
      (file) => file === artifact || file.startsWith(`${artifact}/`),
    )
  )
    failures.push(`tracked artifact ${artifact}`);
}

if (failures.length) {
  process.stderr.write(`Release integrity failed: ${failures.join(", ")}\n`);
  process.exit(1);
}
process.stdout.write("Release integrity verified for CommitTrail v1.0.0.\n");
