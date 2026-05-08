import { createServer } from "node:http";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { ensureAdminAccount } from "./bootstrap/ensureAdmin.js";

async function bootstrap() {
  await ensureAdminAccount();

  const app = createApp();
  const server = createServer(app);

  server.listen(env.PORT, "0.0.0.0", () => {
    console.log(`BAZAR DO BIÉ API em http://0.0.0.0:${env.PORT}/api/v1/health`);
  });
}

bootstrap().catch((err) => {
  console.error("Falha no arranque da API:", err);
  process.exit(1);
});