import { User, OTP } from "../../models/index.js";
import AppError from "../../utils/AppError.js";
import generateToken from "../../utils/genarateTokens.js";
import MailService from "../mail/mail.service.js";
import jwt from "jsonwebtoken";

export class AuthService {
  // ── Register ──────────────────────────────────────────────────────────────
  static async register(userData) {
    const { name, email, password, phone, verificationToken } = userData;
    const role = userData.role || "user";

    if (role === "admin") {
      throw new AppError("Admin role is not allowed for self-registration", 400);
    }

    // 1. Verify verification token
    if (!verificationToken) {
      throw new AppError(
        "Email verification is required. Please verify your email first.",
        400,
      );
    }

    let decoded;
    try {
      decoded = jwt.verify(verificationToken, process.env.SECRET_KEY);
    } catch (err) {
      throw new AppError("Invalid or expired verification token", 400);
    }

    if (decoded.purpose !== "registration_verified") {
      throw new AppError("Invalid token purpose", 400);
    }

    if (decoded.email !== email) {
      throw new AppError("Email does not match the verified email", 400);
    }

    // 2. Check if user already exists
    const userExists = await User.findOne({ where: { email } });
    if (userExists) {
      throw new AppError("User already exists", 400);
    }

    if (phone) {
      const existingPhone = await User.findOne({ where: { phone } });
      if (existingPhone) {
        throw new AppError("Phone number already exists", 400);
      }
    }

    // 3. Create user
    const user = await User.create({
      name,
      email,
      password,
      role,
      phone: phone || null,
      avatar: userData.avatar || null,
      bio: userData.bio || null,
    });

    // 4. Generate token
    const token = await generateToken({ id: user.id, role: user.role });

    return { user: user.toSafeJSON(), token };
  }

  // ── Login ─────────────────────────────────────────────────────────────────
  static async login(email, password) {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      throw new AppError("Invalid credentials", 401);
    }

    const isMatch = await user.correctPassword(password, user.password);
    if (!isMatch) {
      throw new AppError("Invalid credentials", 401);
    }

    const token = await generateToken({ id: user.id, role: user.role });
    return { user: user.toSafeJSON(), token };
  }

  // ── Get Me ────────────────────────────────────────────────────────────────
  static async getMe(userId) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }
    return user.toSafeJSON();
  }

  // ── Update Me ─────────────────────────────────────────────────────────────
  static async updateMe(userId, updateData) {
    const { name, avatar, bio, publicKey, phone } = updateData;

    const user = await User.findByPk(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    // Prepare update object — only allowed fields
    const dataToUpdate = {};
    if (name !== undefined) dataToUpdate.name = name;
    if (avatar !== undefined) dataToUpdate.avatar = avatar;
    if (bio !== undefined) dataToUpdate.bio = bio;
    if (publicKey !== undefined) dataToUpdate.publicKey = publicKey;

    // Handle phone update (only if user doesn't have one yet)
    if (phone && !user.phone) {
      const existingPhone = await User.findOne({ where: { phone } });
      if (existingPhone) {
        throw new AppError("Phone number already in use", 400);
      }
      dataToUpdate.phone = phone;
    }

    await user.update(dataToUpdate);
    return user.toSafeJSON();
  }

  // ── Change Password ───────────────────────────────────────────────────────
  static async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    // Only verify current password if the user has one
    if (user.password) {
      if (!currentPassword) {
        throw new AppError("Current password is required", 400);
      }
      const isMatch = await user.correctPassword(currentPassword, user.password);
      if (!isMatch) {
        throw new AppError("Incorrect current password", 401);
      }
    }

    user.password = newPassword;
    await user.save();

    return { message: "Password changed successfully" };
  }

  // ── Delete Me ─────────────────────────────────────────────────────────────
  static async deleteMe(userId, password) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    // Require password only if user has one set
    if (user.password) {
      if (!password) {
        throw new AppError("Password is required to delete account", 400);
      }
      const isMatch = await user.correctPassword(password, user.password);
      if (!isMatch) {
        throw new AppError("Incorrect password", 401);
      }
    }

    await user.destroy();
    return user.toSafeJSON();
  }

  // ── Forgot Password ──────────────────────────────────────────────────────
  static async forgotPassword(email) {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      throw new AppError("User not found", 404);
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await OTP.create({ email, otp });
    await MailService.sendOTP(email, otp);

    return { message: "OTP sent successfully" };
  }

  // ── Verify OTP (for password reset) ───────────────────────────────────────
  static async verifyOTP(email, otp) {
    const otpRecord = await OTP.findValidOTP(email, otp);
    if (!otpRecord) {
      throw new AppError("Invalid or expired OTP", 400);
    }

    const resetToken = jwt.sign(
      { email, purpose: "password_reset" },
      process.env.SECRET_KEY,
      { expiresIn: "15m" },
    );

    return { resetToken };
  }

  // ── Reset Password ────────────────────────────────────────────────────────
  static async resetPassword(resetToken, newPassword) {
    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.SECRET_KEY);
    } catch (err) {
      throw new AppError("Invalid or expired reset token", 400);
    }

    if (decoded.purpose !== "password_reset") {
      throw new AppError("Invalid token type", 400);
    }

    const user = await User.findOne({ where: { email: decoded.email } });
    if (!user) {
      throw new AppError("User not found", 404);
    }

    user.password = newPassword;
    await user.save();

    return { message: "Password reset successfully" };
  }

  // ── Send Verification OTP (pre-registration) ─────────────────────────────
  static async sendVerificationOTP(email, phone) {
    const userExists = await User.findOne({ where: { email } });
    if (userExists) {
      throw new AppError("User already exists", 400);
    }

    if (phone) {
      const existingPhone = await User.findOne({ where: { phone } });
      if (existingPhone) {
        throw new AppError("Phone number already exists", 400);
      }
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await OTP.create({ email, otp });
    await MailService.sendVerificationOTP(email, otp);

    return { message: "Verification OTP sent successfully" };
  }

  // ── Verify Email (pre-registration) ───────────────────────────────────────
  static async verifyEmail(email, otp) {
    const otpRecord = await OTP.findValidOTP(email, otp);
    if (!otpRecord) {
      throw new AppError("Invalid or expired OTP", 400);
    }

    const verificationToken = jwt.sign(
      { email, purpose: "registration_verified" },
      process.env.SECRET_KEY,
      { expiresIn: "1h" },
    );

    // Clean up used OTP
    await otpRecord.destroy();

    return { verificationToken };
  }
}
