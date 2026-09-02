import { createServer } from "node:http";
import { createApp } from "./createApp.js";
import { env } from "./config/env.js";
import { runMigrations } from "./db/migrate.js";

async function main() {
  await runMigrations();

  const app = createApp();
  const server = createServer(app);

  server.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
