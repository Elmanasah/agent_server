import { DataTypes, Model } from 'sequelize';
import sequelize from '../../db/index.js';

class UsagePlan extends Model {}

UsagePlan.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  planName: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  imageLimit: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 10,
  },
  videoLimit: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 5,
  },
  apiCallLimit: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 100,
  },
  documentLimit: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 20,
  },
  resetPeriod: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'daily',
    validate: { isIn: [['daily', 'monthly']] },
  },
}, {
  sequelize,
  modelName: 'UsagePlan',
  tableName: 'usage_plans',
  timestamps: true,
});

export default UsagePlan;