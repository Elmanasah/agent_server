/**
 * src/modules/auth/otp.model.test.js
 */
import { OTP } from '../../models/index.js';

describe("OTPModel", () => {
  beforeEach(async () => {
    await OTP.destroy({ where: {} });
  });

  it("should create a valid OTP", async () => {
    const otpRec = await OTP.create({ email: "o@example.com", otp: "123456" });
    expect(otpRec.email).toBe("o@example.com");
  });

  it("findValidOTP should return OTP if it is within 5 minutes", async () => {
    await OTP.create({ email: "valid@example.com", otp: "654321" });
    const found = await OTP.findValidOTP("valid@example.com", "654321");
    expect(found.otp).toBe("654321");
  });
});
