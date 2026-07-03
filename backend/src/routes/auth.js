import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { readDb, publicUser } from "../db.js";
import { authRequired, signToken } from "../middleware/auth.js";
import { asyncRoute, validate } from "../middleware/validate.js";

const router = Router();
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(4) });
const googleSchema = z.object({ email: z.string().email(), name: z.string().min(2), role: z.enum(["admin", "employee"]).default("employee") });

router.post("/login", validate(loginSchema), asyncRoute(async (req, res) => {
  const db = await readDb();
  const user = db.users.find((item) => item.email.toLowerCase() === req.body.email.toLowerCase() && item.active);
  if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) {
    return res.status(401).json({ message: "Invalid credentials" });
  }
  const token = signToken(user);
  res.cookie("token", token, { httpOnly: true, sameSite: "strict", secure: false, maxAge: 7200000 });
  res.json({ token, user: publicUser(user), expiresIn: process.env.JWT_EXPIRES_IN || "2h" });
}));

router.post("/google", validate(googleSchema), asyncRoute(async (req, res) => {
  const db = await readDb();
  const user = db.users.find((item) => item.email.toLowerCase() === req.body.email.toLowerCase() && item.active);
  if (!user) return res.status(401).json({ message: "Google account is not provisioned by admin" });
  const token = signToken(user);
  res.cookie("token", token, { httpOnly: true, sameSite: "strict", secure: false, maxAge: 7200000 });
  res.json({ token, user: publicUser(user), expiresIn: process.env.JWT_EXPIRES_IN || "2h" });
}));

router.post("/logout", (_req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logged out" });
});

router.get("/me", authRequired, asyncRoute(async (req, res) => {
  const db = await readDb();
  const user = db.users.find((item) => item.id === req.auth.sub);
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({ user: publicUser(user) });
}));

export default router;
