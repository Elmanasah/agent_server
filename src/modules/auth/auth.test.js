/**
 * Auth Service Tests
 */
import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';

// Mock dependencies using unstable_mockModule for ESM
await jest.unstable_mockModule('../mail/mail.service.js', () => ({
  default: {
    sendOTP: jest.fn().mockResolvedValue(true),
    sendVerificationOTP: jest.fn().mockResolvedValue(true),
  }
}));

await jest.unstable_mockModule('../../utils/genarateTokens.js', () => ({
  default: jest.fn().mockResolvedValue('mock_token'),
}));

// Re-import the service and models AFTER mocking the dependencies
const { AuthService } = await import('./auth.service.js');
const { User } = await import('../../models/index.js');

describe('AuthService', () => {
  const testUser = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'password123',
    role: 'user',
  };

  beforeEach(async () => {
    // Clear the users table before each test
    await User.destroy({ where: {}, truncate: { cascade: true } });
    jest.clearAllMocks();
  });

  describe('register', () => {
    let verificationToken;

    beforeEach(() => {
      verificationToken = jwt.sign(
        { email: testUser.email, purpose: 'registration_verified' },
        process.env.SECRET_KEY || 'test_secret'
      );
    });

    it('should register a new user successfully', async () => {
      const result = await AuthService.register({
        ...testUser,
        verificationToken,
      });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
      expect(result.user.email).toBe(testUser.email);
      expect(result.user.role).toBe('user');

      const userInDb = await User.findOne({ where: { email: testUser.email } });
      expect(userInDb).not.toBeNull();
    });

    it('should reject admin role registration', async () => {
      await expect(AuthService.register({
        ...testUser,
        role: 'admin',
        verificationToken,
      })).rejects.toThrow('Admin role is not allowed for self-registration');
    });

    it('should reject duplicate email', async () => {
      await AuthService.register({
        ...testUser,
        verificationToken,
      });

      const newToken = jwt.sign(
        { email: testUser.email, purpose: 'registration_verified' },
        process.env.SECRET_KEY || 'test_secret'
      );

      await expect(AuthService.register({
        ...testUser,
        verificationToken: newToken,
      })).rejects.toThrow('User already exists');
    });

    it('should reject invalid verification token', async () => {
      await expect(AuthService.register({
        ...testUser,
        verificationToken: 'invalid_token',
      })).rejects.toThrow('Invalid or expired verification token');
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      const verificationToken = jwt.sign(
        { email: testUser.email, purpose: 'registration_verified' },
        process.env.SECRET_KEY || 'test_secret'
      );
      await AuthService.register({
        ...testUser,
        verificationToken,
      });
    });

    it('should login successfully with correct credentials', async () => {
      const result = await AuthService.login(testUser.email, testUser.password);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
      expect(result.user.email).toBe(testUser.email);
    });

    it('should reject invalid email', async () => {
      await expect(
        AuthService.login('wrong@example.com', testUser.password)
      ).rejects.toThrow('Invalid credentials');
    });

    it('should reject invalid password', async () => {
      await expect(
        AuthService.login(testUser.email, 'wrongpassword')
      ).rejects.toThrow('Invalid credentials');
    });
  });
});
