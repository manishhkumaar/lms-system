// Applies supabase/migrations to your hosted database.
// Uses DATABASE_URL from .env.local when it's set (Supabase dashboard → Connect → connection string),
// otherwise the project linked with `npx supabase link`. Extra flags pass through, e.g. -- --dry-run.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("../node_modules/supabase/dist/supabase.js", import.meta.url));
const dbUrl = process.env.DATABASE_URL?.trim();
const args = ["db", "push", ...(dbUrl ? ["--db-url", dbUrl] : []), ...process.argv.slice(2)];

console.log(dbUrl ? "Pushing migrations to the database in DATABASE_URL…" : "Pushing migrations to the linked project…");
// Run the CLI through Node without a shell, so the connection string is passed as-is.
const result = spawnSync(process.execPath, [cli, ...args], { stdio: "inherit" });
process.exit(result.status ?? 1);
