import { Router } from "express";
import { prisma } from "../db.js";
import { WorkflowSchema } from "../workflow.js";
import { requireAuth } from "../auth.js";

export const projectsRouter = Router();

projectsRouter.use(requireAuth as any);

/** List saved projects (newest first). */
projectsRouter.get("/", async (req: any, res) => {
  const user = req.user;
  const projects = await prisma.project.findMany({ where: { ownerId: user.id }, orderBy: { updatedAt: "desc" } });
  res.json(projects.map((p) => ({ ...p, workflow: safeJson(p.workflow) })));
});

/** Create or update a project from a workflow. */
projectsRouter.post("/", async (req, res) => {
  const parsed = WorkflowSchema.safeParse(req.body?.workflow);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid workflow.", details: parsed.error.flatten() });
  }
  const wf = parsed.data;
  const id = typeof req.body?.id === "string" ? req.body.id : undefined;
  const user = (req as any).user;

  const data = {
    name: wf.meta.name,
    description: wf.meta.description,
    network: wf.meta.network,
    workflow: JSON.stringify(wf),
  };

  const createData = { ...data, ownerId: user.id };
  const project = id
    ? await prisma.project.upsert({ where: { id }, update: data, create: createData })
    : await prisma.project.create({ data: createData });

  res.json({ ...project, workflow: wf });
});

projectsRouter.get("/:id", async (req: any, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project || project.ownerId !== req.user.id) return res.status(404).json({ error: "Not found." });
  res.json({ ...project, workflow: safeJson(project.workflow) });
});

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

projectsRouter.delete("/:id", async (req: any, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project || project.ownerId !== req.user.id) return res.status(404).json({ error: "Not found." });
  await prisma.project.delete({ where: { id: req.params.id } }).catch(() => {});
  res.json({ ok: true });
});
