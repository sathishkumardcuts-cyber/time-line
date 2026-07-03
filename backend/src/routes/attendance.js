import { Router } from "express";
import { readDb, writeDb, makeId } from "../db.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { asyncRoute } from "../middleware/validate.js";

const router = Router();
router.use(authRequired);

router.get("/", requireRole("admin"), asyncRoute(async (_req, res) => {
  const db = await readDb();
  res.json(db.attendance);
}));

router.post("/", requireRole("admin"), asyncRoute(async (req, res) => {
  const db = await readDb();
  const record = { id: makeId("att"), ...req.body };
  db.attendance.push(record);
  await writeDb(db);
  res.status(201).json(record);
}));

export default router;
