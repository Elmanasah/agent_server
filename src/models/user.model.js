/**
 * src/models/user.model.js
 */

import { DataTypes, Model } from "sequelize";
import sequelize from "../db/index.js";
import bcrypt from "bcryptjs";

class User extends Model {
  /**
   * Returns a plain object safe for API responses (no password, includes hasPassword flag).
   */
  toSafeJSON() {
    const json = this.toJSON();
    json.hasPassword = !!json.password;
    delete json.password;
    return json;
  }
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: true, // null for Google OAuth users
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    avatar: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    googleId: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    publicKey: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "user",
      validate: {
        isIn: [["user", "admin"]],
      },
    },
  },
  {
    sequelize,
    modelName: "User",
    tableName: "users",
    timestamps: true,
  },
);

// ── Hooks ──────────────────────────────────────────────────────────────────────
User.beforeSave(async (user) => {
  if (user.changed("password") && user.password) {
    user.password = await bcrypt.hash(user.password, 10);
  }
});

// ── Instance methods ──────────────────────────────────────────────────────────
User.prototype.correctPassword = async function (candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

export default User;
