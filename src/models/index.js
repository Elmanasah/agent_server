/**
 * src/models/index.js
 *
 * Loads all models, sets up associations, and exports them.
 * Import from here everywhere — do NOT import individual model files directly.
 */

import sequelize from "../db/index.js";
import UserModel from "./user.model.js";
import SessionModel from "./session.model.js";
import MessageModel from "./message.model.js";
import DocumentModel from "./document.model.js";
import OTPModel from "./otp.model.js";
import Cost from "./cost.js";

// ── Associations ──────────────────────────────────────────────────────────────
UserModel.hasMany(SessionModel, { foreignKey: "userId", as: "sessions" });
SessionModel.belongsTo(UserModel, { foreignKey: "userId", as: "user" });

UserModel.hasMany(DocumentModel, { foreignKey: "userId", as: "documents" });
DocumentModel.belongsTo(UserModel, { foreignKey: "userId", as: "user" });

SessionModel.hasMany(MessageModel, {
  foreignKey: "sessionId",
  as: "messages",
  onDelete: "CASCADE",
});
MessageModel.belongsTo(SessionModel, {
  foreignKey: "sessionId",
  as: "session",
});

// User.hasMany(OTPModel, { foreignKey: "userId", as: "otps" });
// OTPModel.belongsTo(User, { foreignKey: "userId", as: "user" });

export const User = UserModel;
export const Session = SessionModel;
export const Message = MessageModel;
export const Document = DocumentModel;
export const OTP = OTPModel;

export { sequelize };
