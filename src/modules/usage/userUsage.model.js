import { DataTypes, Model } from 'sequelize';
import sequelize from '../../db/index.js';

class UserUsage extends Model {}

UserUsage.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
  },
  planName: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'free',
  },
  imagesUsed: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  videosUsed: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  apiCallsUsed: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  documentsUsed: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  isLocked: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  lockReason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  periodStart: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  lastResetAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  sequelize,
  modelName: 'UserUsage',
  tableName: 'user_usage',
  timestamps: true,
});

export default UserUsage;