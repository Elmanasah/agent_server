import { DataTypes, Model } from "sequelize";
import sequelize from "../../db/index.js";

class Memory extends Model {}

Memory.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    fact: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    category: {
      type: DataTypes.STRING,
      defaultValue: "general",
    },
  },
  {
    sequelize,
    modelName: "Memory",
    tableName: "memories",
    timestamps: true,
  }
);

export default Memory;
