/**
 * src/models/document.model.js
 */

import { DataTypes, Model } from 'sequelize';
import sequelize from '../../db/index.js';

class Document extends Model { }

Document.init({
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    fileName: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    mimeType: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    chunkIds: {
        type: DataTypes.ARRAY(DataTypes.STRING), // GCS chunk IDs
        allowNull: false,
        defaultValue: [],
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: false,
    },
}, {
    sequelize,
    modelName: 'Document',
    tableName: 'documents',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: false,
});

export default Document;
