import { Router } from "express";
import passport from "../../config/passport.js";

const authRouter = Router();

import {
  register,
  login,
  logout,
  getMe,
  updateMe,
  deleteMe,
  forgotPassword,
  verifyOTP,
  resetPassword,
  changePassword,
  sendVerificationOTP,
  verifyEmail,
} from "./auth.controller.js";

import verifyToken from "../../middleware/verifyToken.js";

// ==============================================
// 0. GOOGLE OAUTH ROUTES
// ==============================================

// Redirect to Google to begin authentication
authRouter.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] }),
);

// Google Callback
authRouter.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "/login",
  }),
  (req, res) => {
    const { token } = req.user;

    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("jwt", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    res.redirect(`${frontendUrl}/`);
  },
);

// ==============================================
// 1. AUTH ROUTES (Public)
// ==============================================

// POST /api/v1/auth/register
authRouter.post("/register", register);

// POST /api/v1/auth/login
authRouter.post("/login", login);

// GET /api/v1/auth/logout
authRouter.get("/logout", logout);

// POST /api/v1/auth/forgot-password
authRouter.post("/forgot-password", forgotPassword);

// POST /api/v1/auth/verify-otp
authRouter.post("/verify-otp", verifyOTP);

// POST /api/v1/auth/reset-password
authRouter.post("/reset-password", resetPassword);

// POST /api/v1/auth/send-verification-otp
authRouter.post("/send-verification-otp", sendVerificationOTP);

// POST /api/v1/auth/verify-email
authRouter.post("/verify-email", verifyEmail);

// ==============================================
// 2. "ME" ROUTES (Authenticated)
// ==============================================

// GET /api/v1/auth/me
authRouter.get("/me", verifyToken, getMe);

// PUT /api/v1/auth/me
authRouter.put("/me", verifyToken, updateMe);

// POST /api/v1/auth/change-password
authRouter.post("/change-password", verifyToken, changePassword);

// DELETE /api/v1/auth/me
authRouter.delete("/me", verifyToken, deleteMe);

export default authRouter;
