/**
 * src/models/index.js
 *
 * Loads all models, sets up associations, and exports them.
 * Import from here everywhere — do NOT import individual model files directly.
 */

import sequelize from "../db/index.js";
import UserModel from "../modules/users/user.model.js";
import SessionModel from "../modules/sessions/session.model.js";
import MessageModel from "../modules/chat/message.model.js";
import DocumentModel from "../modules/documents/document.model.js";
import OTPModel from "../modules/auth/otp.model.js";
import MemoryModel from "../modules/memory/memory.model.js";
import TaskModel from "../modules/tasks/task.model.js";

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

UserModel.hasMany(MemoryModel, { foreignKey: "userId", as: "memories", onDelete: "CASCADE" });
MemoryModel.belongsTo(UserModel, { foreignKey: "userId", as: "user" });

UserModel.hasMany(TaskModel, { foreignKey: "userId", as: "tasks", onDelete: "CASCADE" });
TaskModel.belongsTo(UserModel, { foreignKey: "userId", as: "user" });

export const User = UserModel;
export const Session = SessionModel;
export const Message = MessageModel;
export const Document = DocumentModel;
export const OTP = OTPModel;
export const Memory = MemoryModel;
export const Task = TaskModel;

export { sequelize };
