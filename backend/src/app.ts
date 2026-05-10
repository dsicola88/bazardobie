import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "node:path";
import { env, isR2Configured } from "./config/env.js";
import { corsAllowedOrigins } from "./config/corsOrigins.js";
import routes from "./routes/index.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import "./types/auth.js";

function warnIfUploadDiskProbablyEphemeral() {
  if (env.NODE_ENV !== "production") return;
  if (isR2Configured()) return;
  const quiet =
    process.env.UPLOAD_VOLUME_MOUNTED === "1" || process.env.UPLOAD_VOLUME_MOUNTED === "true";
  if (quiet) return;

  const resolved = path.resolve(env.UPLOAD_DIR);
  const cwdUploads = path.resolve(process.cwd(), "uploads");
  /** Dockerfile da API Railway usa WORKDIR=/app e UPLOAD_DIR=/app/uploads */
  const looksLikeRailwayDocker = resolved === path.resolve("/app/uploads") || resolved === cwdUploads;

  if (looksLikeRailwayDocker) {
    console.warn(
      "[uploads] UPLOAD_DIR=" +
        resolved +
        " — o disco do contentor é normalmente EFÉMERO em cada novo deploy " +
        "(cada novo deploy não traz estas pastas a partir da máquina local). " +
        "Imagens ficam registadas na base de dados como /uploads/… mas os ficheiros somem quando o contentor renova. " +
        "Com R2 (R2_* na API) os novos uploads vão para o balde em vez do disco local.\n" +
        "[uploads] Solução: na Railway → serviço da API → criar Volume e montar no caminho /app/uploads (ou definir UPLOAD_DIR " +
        "para apontar a esse volume).\n" +
        "[uploads] Se já tem volume montado aqui, defina UPLOAD_VOLUME_MOUNTED=true para omitir este aviso."
    );
  }
}

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  if (env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  const allowedBrowserOrigins = corsAllowedOrigins();
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) {
          callback(null, true);
          return;
        }
        callback(null, allowedBrowserOrigins.includes(origin));
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: "2mb" }));

  app.use("/uploads", express.static(path.resolve(env.UPLOAD_DIR)));

  warnIfUploadDiskProbablyEphemeral();

  app.use("/api/v1", routes);

  app.use(errorHandler);

  return app;
}
