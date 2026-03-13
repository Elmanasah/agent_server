import { AuthService } from "./auth.service.js";
import { catchAsync } from "../../utils/catchAsync.js";

export const register = catchAsync(async (req, res) => {
  const { user, token } = await AuthService.register(req.body);

  const isProduction = process.env.NODE_ENV === "production";

  res.cookie("jwt", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.status(201).json({
    message: "User registered successfully",
    data: { user, token },
  });
});

export const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const { user, token } = await AuthService.login(email, password);

  const isProduction = process.env.NODE_ENV === "production";
  res.cookie("jwt", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.status(200).json({
    message: "User logged in successfully",
    data: { user, token },
  });
});

export const logout = (req, res) => {
  const isProduction = process.env.NODE_ENV === "production";
  res.cookie("jwt", "loggedout", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
  });
  res.status(200).json({ status: "success" });
};

export const getMe = catchAsync(async (req, res) => {
  const user = await AuthService.getMe(req.user.id);
  res.status(200).json({ data: user });
});

export const updateMe = catchAsync(async (req, res) => {
  const user = await AuthService.updateMe(req.user.id, req.body);
  res.status(200).json({
    message: "Profile updated successfully",
    data: user,
  });
});

export const deleteMe = catchAsync(async (req, res) => {
  const password = req.body.password;
  await AuthService.deleteMe(req.user.id, password);
  res.status(200).json({ message: "User account deleted successfully" });
});

export const forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;
  const result = await AuthService.forgotPassword(email);
  res.status(200).json(result);
});

export const verifyOTP = catchAsync(async (req, res) => {
  const { email, otp } = req.body;
  const result = await AuthService.verifyOTP(email, otp);
  res.status(200).json(result);
});

export const resetPassword = catchAsync(async (req, res) => {
  const { resetToken, newPassword } = req.body;
  const result = await AuthService.resetPassword(resetToken, newPassword);
  res.status(200).json(result);
});

export const changePassword = catchAsync(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const result = await AuthService.changePassword(
    req.user.id,
    currentPassword,
    newPassword,
  );
  res.status(200).json(result);
});

export const sendVerificationOTP = catchAsync(async (req, res) => {
  const { email, phone } = req.body;
  const result = await AuthService.sendVerificationOTP(email, phone);
  res.status(200).json(result);
});

export const verifyEmail = catchAsync(async (req, res) => {
  const { email, otp } = req.body;
  const result = await AuthService.verifyEmail(email, otp);
  res.status(200).json(result);
});
