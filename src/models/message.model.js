/**
 * src/models/message.model.js
 */

import { DataTypes, Model } from 'sequelize';
import sequelize from '../db/index.js';

class Message extends Model { }

Message.init({
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    role: {
        type: DataTypes.STRING(10),  // "user" | "model"
        allowNull: false,
    },
    parts: {
        type: DataTypes.JSONB,       // Vertex AI parts array
        allowNull: false,
    },
    sessionId: {
        type: DataTypes.UUID,
        allowNull: false,
    },
}, {
    sequelize,
    modelName: 'Message',
    tableName: 'messages',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: false,
});

export default Message;
