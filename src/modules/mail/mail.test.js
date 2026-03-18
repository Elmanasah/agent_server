import { jest } from '@jest/globals';

// Mock nodemailer using unstable_mockModule for ESM
const sendMailMock = jest.fn().mockResolvedValue({ messageId: 'test-id' });
await jest.unstable_mockModule('nodemailer', () => ({
  default: {
    createTransport: jest.fn().mockReturnValue({
      sendMail: sendMailMock,
    }),
  },
}));

// Re-import the service AFTER mocking the dependency
const { default: MailService } = await import('./mail.service.js');

describe('MailService', () => {
  beforeEach(() => {
    sendMailMock.mockClear();
  });

  describe('sendOTP', () => {
    it('should send OTP email', async () => {
      const email = 'ibrahim.hesham.hemdan@gmail.com';
      const otp = '123456';

      await MailService.sendOTP(email, otp);

      expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
        to: email,
        subject: '🔐 كود تغيير كلمة المرور',
        text: expect.stringContaining(otp),
      }));
    });
  });

  describe('verifyParent', () => {
    it('should send parent verification email', async () => {
      const email = 'ibrahim.hesham.hemdan@gmail.com';
      const otp = '654321';

      await MailService.verifyParent(email, otp);

      expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
        to: email,
        subject: '👨‍👩‍👧‍👦 كود ربط ولي الأمر',
      }));
    });
  });

  describe('sendVerificationOTP', () => {
    it('should send verification email', async () => {
      const email = 'ibrahim.hesham.hemdan@gmail.com';
      const otp = '111222';

      await MailService.sendVerificationOTP(email, otp);

      expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
        to: email,
        subject: '✨ تأكيد حسابك الجديد',
      }));
    });
  });
});
