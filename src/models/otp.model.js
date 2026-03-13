/**
 * src/models/otp.model.js
 *
 * One-time password model for email verification and password resets.
 * OTPs expire after 5 minutes (enforced in findValidOTP).
 */

import { DataTypes, Model, Op } from "sequelize";
import sequelize from "../db/index.js";

class OTP extends Model {
    /**
     * Find a valid (non-expired) OTP for the given email.
     * OTPs are valid for 5 minutes from creation.
     */
    static async findValidOTP(email, otp) {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

        return await OTP.findOne({
            where: {
                email,
                otp,
                createdAt: { [Op.gte]: fiveMinutesAgo },
            },
        });
    }
}

OTP.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        otp: {
            type: DataTypes.STRING(6),
            allowNull: false,
        },
    },
    {
        sequelize,
        modelName: "OTP",
        tableName: "otps",
        timestamps: true,
        updatedAt: false,
    },
);

export default OTP;
