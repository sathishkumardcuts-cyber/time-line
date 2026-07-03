import { Router } from "express";
import { readDb, writeDb } from "../db.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { asyncRoute } from "../middleware/validate.js";

const router = Router();
router.use(authRequired, requireRole("admin"));

router.get("/", asyncRoute(async (_req, res) => {
  const db = await readDb();
  res.json(db.settings);
}));

router.put("/", asyncRoute(async (req, res) => {
  const db = await readDb();
  db.settings = { ...db.settings, ...req.body };
  await writeDb(db);
  res.json(db.settings);
}));

export default router;
