import { Router } from "express";
import { readDb } from "../db.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { asyncRoute } from "../middleware/validate.js";

const router = Router();
router.use(authRequired);

router.get("/dashboard", requireRole("admin"), asyncRoute(async (_req, res) => {
  const db = await readDb();
  const totalHours = db.timesheets.reduce((sum, item) => sum + Number(item.hours), 0);
  res.json({
    totalEmployees: db.employees.length,
    activeEmployees: db.employees.filter((item) => item.active).length,
    totalWorkingHours: totalHours,
    pendingReports: db.timesheets.filter((item) => item.status === "pending").length,
    approvedReports: db.timesheets.filter((item) => item.status === "approved").length,
    rejectedReports: db.timesheets.filter((item) => item.status === "rejected").length,
    projectStatus: db.settings.projects.map((project) => ({ project, hours: db.timesheets.filter((item) => item.project === project).reduce((sum, item) => sum + Number(item.hours), 0) })),
    attendanceSummary: db.attendance.reduce((acc, item) => ({ ...acc, [item.status]: (acc[item.status] || 0) + 1 }), {}),
    todayActivity: db.timesheets.filter((item) => item.date === new Date().toISOString().slice(0, 10))
  });
}));

router.get("/daily", asyncRoute(async (req, res) => {
  const db = await readDb();
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const rows = db.timesheets.filter((item) => item.date === date && (req.auth.role === "admin" || item.userId === req.auth.sub));
  res.json(rows);
}));

router.get("/monthly", requireRole("admin"), asyncRoute(async (req, res) => {
  const db = await readDb();
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  res.json(db.timesheets.filter((item) => item.date.startsWith(month)));
}));

router.get("/export/:format", requireRole("admin"), asyncRoute(async (req, res) => {
  const db = await readDb();
  const format = req.params.format;
  if (!["pdf", "excel", "json"].includes(format)) return res.status(400).json({ message: "Unsupported export format" });
  res.json({ format, generatedAt: new Date().toISOString(), records: db.timesheets });
}));

export default router;
