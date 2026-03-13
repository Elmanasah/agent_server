import { User } from "../../models/index.js";
import AppError from "../../utils/AppError.js";
import { Op } from "sequelize";

export class UserService {
  // ── Get All Users (Admin) ─────────────────────────────────────────────────
  static async getAllUsers(query = {}) {
    const page = parseInt(query.page, 10) || 1;
    const limit = parseInt(query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const { count, rows: users } = await User.findAndCountAll({
      attributes: { exclude: ["password"] },
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    return { users, usersCount: count };
  }

  // ── Get Single User ───────────────────────────────────────────────────────
  static async getUser(userId) {
    const user = await User.findByPk(userId, {
      attributes: { exclude: ["password"] },
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }
    return user;
  }

  // ── Update User (Admin) ───────────────────────────────────────────────────
  static async updateUser(userId, updateData) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    // Only allow specific fields
    const allowedFields = ["name", "role", "avatar", "bio", "phone"];
    const dataToUpdate = {};
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        dataToUpdate[field] = updateData[field];
      }
    }

    await user.update(dataToUpdate);

    // Return without password
    const result = user.toJSON();
    delete result.password;
    return result;
  }

  // ── Delete User (Admin) ───────────────────────────────────────────────────
  static async deleteUser(userId) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    await user.destroy();
    return user;
  }

  // ── Public Profile ────────────────────────────────────────────────────────
  static async getPublicProfile(userId) {
    const user = await User.findByPk(userId, {
      attributes: ["id", "name", "avatar", "role", "bio", "createdAt"],
    });
    if (!user) {
      throw new AppError("User not found", 404);
    }
    return user;
  }

  // ── Find User by Email ────────────────────────────────────────────────────
  static async findUserByEmail(email) {
    const user = await User.findOne({
      where: { email },
      attributes: ["id", "name", "email", "avatar", "role", "phone"],
    });
    if (!user) {
      throw new AppError("User not found", 404);
    }
    return user;
  }

  // ── Platform Stats ────────────────────────────────────────────────────────
  static async getPlatformStats() {
    const totalUsers = await User.count();
    const adminCount = await User.count({ where: { role: "admin" } });

    return {
      totalUsers,
      admins: adminCount,
    };
  }
}
