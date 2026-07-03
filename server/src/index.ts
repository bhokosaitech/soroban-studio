import express from "express";
import cors from "cors";
import { env } from "./env.js";
import { NETWORK } from "./stellar/network.js";
import { runsRouter } from "./routes/runs.js";
import { projectsRouter } from "./routes/projects.js";
import { walletsRouter } from "./routes/wallets.js";
import { schedulesRouter } from "./routes/schedules.js";
import { initScheduler, schedulerMode } from "./scheduler/index.js";

const app = express();

app.use(cors({ origin: env.corsOrigins }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, network: NETWORK.id, horizon: NETWORK.horizonUrl, scheduler: schedulerMode });
});

app.use("/api/runs", runsRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/wallets", walletsRouter);
app.use("/api/schedules", schedulesRouter);

app.listen(env.port, async () => {
  console.log(`⚡ Soroban Studio server on http://localhost:${env.port} (${NETWORK.id})`);
  await initScheduler();
});
