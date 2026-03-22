/**
 * src/models/session.model.js
 */

import { DataTypes, Model } from 'sequelize';
import sequelize from '../../db/index.js';

class Session extends Model { }

Session.init({
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    title: {
        type: DataTypes.STRING(120),
        allowNull: false,
        defaultValue: 'New conversation',
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: false,
    },
}, {
    sequelize,
    modelName: 'Session',
    tableName: 'sessions',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
});

export default Session;
