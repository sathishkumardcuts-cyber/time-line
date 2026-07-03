import { Router } from "express";
import { z } from "zod";
import { readDb, writeDb, makeId } from "../db.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { asyncRoute, validate } from "../middleware/validate.js";

const router = Router();
const sheetSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), task: z.string().min(2), project: z.string().min(2), hours: z.number().min(0).max(24), breakTime: z.number().min(0).max(8).default(0), comments: z.string().max(1000).optional().default("") });

router.use(authRequired);

router.get("/", asyncRoute(async (req, res) => {
  const db = await readDb();
  const rows = req.auth.role === "admin" ? db.timesheets : db.timesheets.filter((item) => item.userId === req.auth.sub);
  res.json(rows);
}));

router.post("/", validate(sheetSchema), asyncRoute(async (req, res) => {
  const db = await readDb();
  const user = db.users.find((item) => item.id === req.auth.sub);
  const record = { id: makeId("ts"), userId: user.id, employeeId: user.employeeId, ...req.body, status: "pending", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  db.timesheets.push(record);
  await writeDb(db);
  res.status(201).json(record);
}));

router.put("/:id", asyncRoute(async (req, res) => {
  const db = await readDb();
  const index = db.timesheets.findIndex((item) => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ message: "Timesheet not found" });
  const existing = db.timesheets[index];
  if (req.auth.role !== "admin" && existing.userId !== req.auth.sub) return res.status(403).json({ message: "Access denied" });
  if (req.auth.role !== "admin" && existing.status === "approved") return res.status(409).json({ message: "Approved timesheets cannot be edited" });
  db.timesheets[index] = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
  await writeDb(db);
  res.json(db.timesheets[index]);
}));

router.patch("/:id/status", requireRole("admin"), validate(z.object({ status: z.enum(["pending", "approved", "rejected"]) })), asyncRoute(async (req, res) => {
  const db = await readDb();
  const index = db.timesheets.findIndex((item) => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ message: "Timesheet not found" });
  db.timesheets[index] = { ...db.timesheets[index], status: req.body.status, updatedAt: new Date().toISOString() };
  await writeDb(db);
  res.json(db.timesheets[index]);
}));

router.delete("/:id", requireRole("admin"), asyncRoute(async (req, res) => {
  const db = await readDb();
  db.timesheets = db.timesheets.filter((item) => item.id !== req.params.id);
  await writeDb(db);
  res.json({ message: "Timesheet deleted" });
}));

export default router;
