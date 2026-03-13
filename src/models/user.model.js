/**
 * src/models/user.model.js
 */

import { DataTypes, Model } from 'sequelize';
import sequelize from '../db/index.js';

class User extends Model { }

User.init({
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    uid: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,   // Firebase UID or "default"
    },
}, {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: false,
});

export default User;
