// src/modules/logs/log.model.js
//
// Activity log — every row expires after 2 days (expiresAt).
// An hourly cron job purges expired rows (see logScheduler.js).

import { DataTypes, Model } from 'sequelize';
import sequelize from '../../db/index.js';

class Log extends Model {}

Log.init({
  id: {
    type:         DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey:   true,
  },
  // null = system event (no specific user)
  userId: {
    type:      DataTypes.UUID,
    allowNull: true,
  },
  // Category helps filter logs in the admin panel
  category: {
    type:      DataTypes.STRING(20),
    allowNull: false,
    validate:  { isIn: [['auth', 'usage', 'admin', 'system', 'api', 'ai', 'error', 'warning', 'action']] },
  },
  // Short machine-readable label like 'plan_changed', 'login_failed'
  action: {
    type:      DataTypes.STRING(100),
    allowNull: false,
  },
  // Any extra structured context — plan change: { from, to }, etc.
  meta: {
    type:      DataTypes.JSONB,
    allowNull: true,
  },
  // Requester's IP (IPv4 or IPv6)
  ip: {
    type:      DataTypes.STRING(45),
    allowNull: true,
  },
  userAgent: {
    type:      DataTypes.TEXT,
    allowNull: true,
  },
  // For 'api' category — HTTP status of the response
  statusCode: {
    type:      DataTypes.INTEGER,
    allowNull: true,
  },
  // createdAt + 2 days — indexed for efficient purge queries
  expiresAt: {
    type:      DataTypes.DATE,
    allowNull: false,
  },
}, {
  sequelize,
  modelName: 'Log',
  tableName: 'activity_logs',
  timestamps: true,
  updatedAt:  false,     // logs are immutable — no updatedAt needed
  indexes: [
    { fields: ['expiresAt'] },                    // for purge scheduler
    { fields: ['userId', 'createdAt'] },          // for user history queries
    { fields: ['category', 'createdAt'] },        // for category filters
  ],
});

export default Log;
