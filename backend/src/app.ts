import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "node:path";
import { env } from "./config/env.js";
import routes from "./routes/index.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import "./types/auth.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  if (env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: "2mb" }));

  app.use("/uploads", express.static(path.resolve(env.UPLOAD_DIR)));

  if (env.NODE_ENV === "production" && env.UPLOAD_DIR === "./uploads") {
    console.warn(
      "[uploads] UPLOAD_DIR está no valor padrão ./uploads em produção. " +
        "Sem volume persistente (ou storage externo), imagens podem desaparecer após deploy/restart."
    );
  }

  app.use("/api/v1", routes);

  app.use(errorHandler);

  return app;
}
