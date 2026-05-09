import { createServer } from "node:http";
import { createApp } from "./app.js";
import { env, isR2Configured } from "./config/env.js";
import { ensureAdminAccount } from "./bootstrap/ensureAdmin.js";

async function bootstrap() {
  await ensureAdminAccount();

  const app = createApp();
  const server = createServer(app);

  server.listen(env.PORT, "0.0.0.0", () => {
    console.log(`BAZAR DO BIÉ API em http://0.0.0.0:${env.PORT}/api/v1/health`);
    if (isR2Configured()) {
      console.log(
        `[R2] Uploads para o balde "${env.R2_BUCKET}" | ${env.R2_PUBLIC_BASE_URL}`
      );
    } else {
      console.log(
        "[R2] Não usado (env incompleto ou R2_UPLOADS_ENABLED=0) — uploads em disco (UPLOAD_DIR)."
      );
    }
  });
}

bootstrap().catch((err) => {
  console.error("Falha no arranque da API:", err);
  process.exit(1);
});