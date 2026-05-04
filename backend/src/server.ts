import { createServer } from "node:http";
import { createApp } from "./app.js";
import { env } from "./config/env.js";

const app = createApp();
const server = createServer(app);

server.listen(env.PORT, () => {
  console.log(`BAZAR DO BIÉ API em http://localhost:${env.PORT}/api/v1/health`);
});
