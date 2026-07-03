import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { readDb, writeDb, makeId } from "../db.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { asyncRoute, validate } from "../middleware/validate.js";

const router = Router();
const employeeSchema = z.object({ name: z.string().min(2), email: z.string().email().optional(), employeeId: z.string().min(2), department: z.string().min(2), project: z.string().min(2), photo: z.string().url().optional().or(z.literal("")), active: z.boolean().default(true), role: z.enum(["admin", "employee"]).default("employee") });

router.use(authRequired);

router.get("/", asyncRoute(async (req, res) => {
  const db = await readDb();
  if (req.auth.role === "employee") {
    return res.json(db.employees.filter((item) => item.employeeId === req.auth.employeeId));
  }
  res.json(db.employees);
}));

router.post("/", requireRole("admin"), validate(employeeSchema), asyncRoute(async (req, res) => {
  const db = await readDb();
  const userId = makeId("u");
  const passwordHash = await bcrypt.hash("ChangeMe123", 10);
  const employee = { id: makeId("emp"), userId, ...req.body, photo: req.body.photo || "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&h=200&fit=crop" };
  const user = { id: userId, name: req.body.name, email: req.body.email || `${req.body.employeeId.toLowerCase()}@pulsedesk.test`, role: req.body.role, employeeId: req.body.employeeId, department: req.body.department, photo: employee.photo, passwordHash, active: req.body.active };
  db.employees.push(employee);
  db.users.push(user);
  await writeDb(db);
  res.status(201).json(employee);
}));

router.put("/:id", requireRole("admin"), validate(employeeSchema.partial()), asyncRoute(async (req, res) => {
  const db = await readDb();
  const index = db.employees.findIndex((item) => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ message: "Employee not found" });
  db.employees[index] = { ...db.employees[index], ...req.body };
  await writeDb(db);
  res.json(db.employees[index]);
}));

router.delete("/:id", requireRole("admin"), asyncRoute(async (req, res) => {
  const db = await readDb();
  const employee = db.employees.find((item) => item.id === req.params.id);
  if (!employee) return res.status(404).json({ message: "Employee not found" });
  db.employees = db.employees.filter((item) => item.id !== req.params.id);
  db.users = db.users.map((user) => user.employeeId === employee.employeeId ? { ...user, active: false } : user);
  await writeDb(db);
  res.json({ message: "Employee removed" });
}));

export default router;
