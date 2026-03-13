import { Router } from "express";
import {
  getAllUsers,
  getUser,
  updateUser,
  deleteUser,
  getPublicProfile,
  getPlatformStats,
  findUserByEmail,
} from "./user.controller.js";
import verifyToken from "../../middleware/verifyToken.js";
import allowTo from "../../middleware/allowTo.js";
import { validateUpdateUser, validate } from "../auth/auth.validator.js";

const userRouter = Router();

// ── Public routes ───────────────────────────────────────────────────────────
// userRouter.get("/stats", getPlatformStats);

// ── Authenticated routes ────────────────────────────────────────────────────
userRouter.use(verifyToken);

// GET /api/v1/users/:id/profile — public profile for any logged-in user
// userRouter.get("/:id/profile", getPublicProfile);

// // GET /api/v1/users/find-by-email — accessible by all authenticated users
// userRouter.get("/find-by-email", findUserByEmail);

// ── Admin-only routes ───────────────────────────────────────────────────────
userRouter.use(allowTo("admin"));

// GET /api/v1/users
userRouter.get("/", getAllUsers);

// GET /api/v1/users/:id
userRouter.get("/:id", getUser);

// PUT /api/v1/users/:id
userRouter.put("/:id", validateUpdateUser, validate, updateUser);

// DELETE /api/v1/users/:id
userRouter.delete("/:id", deleteUser);

export default userRouter;
