import UserModel    from '../modules/users/user.model.js';
import SessionModel from '../modules/sessions/session.model.js';
import MessageModel from '../modules/chat/message.model.js';
import DocumentModel from '../modules/documents/document.model.js';
import OTPModel     from '../modules/auth/otp.model.js';
import MemoryModel  from '../modules/memory/memory.model.js';
import TaskModel    from '../modules/tasks/task.model.js';
import UsagePlanModel  from '../modules/usage/usagePlan.model.js';
import UserUsageModel  from '../modules/usage/userUsage.model.js';
import LogModel     from '../modules/logs/log.model.js';
import sequelize    from '../db/index.js';

// ── Existing associations (unchanged) ────────────────────────────────────────
UserModel.hasMany(SessionModel,  { foreignKey: 'userId', as: 'sessions' });
SessionModel.belongsTo(UserModel, { foreignKey: 'userId', as: 'user' });
UserModel.hasMany(DocumentModel, { foreignKey: 'userId', as: 'documents' });
DocumentModel.belongsTo(UserModel, { foreignKey: 'userId', as: 'user' });
SessionModel.hasMany(MessageModel, { foreignKey: 'sessionId', as: 'messages', onDelete: 'CASCADE' });
MessageModel.belongsTo(SessionModel, { foreignKey: 'sessionId', as: 'session' });
UserModel.hasMany(MemoryModel, { foreignKey: 'userId', as: 'memories', onDelete: 'CASCADE' });
MemoryModel.belongsTo(UserModel, { foreignKey: 'userId', as: 'user' });
UserModel.hasMany(TaskModel, { foreignKey: 'userId', as: 'tasks', onDelete: 'CASCADE' });
TaskModel.belongsTo(UserModel, { foreignKey: 'userId', as: 'user' });

// ── Usage associations ────────────────────────────────────────────────────────
UserModel.hasOne(UserUsageModel, { foreignKey: 'userId', as: 'usage', onDelete: 'CASCADE' });
UserUsageModel.belongsTo(UserModel, { foreignKey: 'userId', as: 'user' });
UserUsageModel.belongsTo(UsagePlanModel, { foreignKey: 'planName', targetKey: 'planName', as: 'plan' });

// ── Log associations ──────────────────────────────────────────────────────────
// userId is nullable (system logs have no user)
UserModel.hasMany(LogModel, { foreignKey: 'userId', as: 'logs', onDelete: 'CASCADE' });
LogModel.belongsTo(UserModel, { foreignKey: 'userId', as: 'user' });

export const User      = UserModel;
export const Session   = SessionModel;
export const Message   = MessageModel;
export const Document  = DocumentModel;
export const OTP       = OTPModel;
export const Memory    = MemoryModel;
export const Task      = TaskModel;
export const UsagePlan = UsagePlanModel;
export const UserUsage = UserUsageModel;
export const Log       = LogModel;

export { sequelize };