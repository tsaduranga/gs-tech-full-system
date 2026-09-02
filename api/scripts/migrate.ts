import { runMigrations } from "../src/db/migrate.js";

runMigrations().catch((err) => {
  console.error(err);
  process.exit(1);
});
