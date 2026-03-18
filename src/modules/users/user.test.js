import { jest } from '@jest/globals';

// Re-import the service and models AFTER mocking any dependencies if needed (none for user service currently)
const { UserService } = await import('./user.service.js');
const { User } = await import('../../models/index.js');

describe('UserService', () => {

  beforeEach(async () => {
    // Clear the users table before each test
    await User.destroy({ where: {}, truncate: { cascade: true } });
  });

  describe('getAllUsers', () => {
    it('should return empty list when no users exist', async () => {
      const result = await UserService.getAllUsers();
      expect(result.users).toHaveLength(0);
      expect(result.usersCount).toBe(0);
    });

    it('should return list of users', async () => {
      await User.bulkCreate([
        { name: 'User 1', email: 'user1@example.com', password: 'password123', phone: '1234567890' },
        { name: 'User 2', email: 'user2@example.com', password: 'password123', phone: '0987654321' },
      ]);

      const result = await UserService.getAllUsers();
      expect(result.users).toHaveLength(2);
      expect(result.usersCount).toBe(2);
    });
  });

  describe('getUser', () => {
    it('should return user by id', async () => {
      const user = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        phone: '1112223333'
      });

      const result = await UserService.getUser(user.id);
      expect(result.email).toBe('test@example.com');
    });

    it('should throw error if user not found', async () => {
      const fakeId = '00000000-0000-4000-a000-000000000000';
      await expect(UserService.getUser(fakeId)).rejects.toThrow('User not found');
    });
  });

  describe('updateUser', () => {
    it('should update user details', async () => {
      const user = await User.create({
        name: 'Original Name',
        email: 'update@example.com',
        password: 'password123',
        phone: '4445556666'
      });

      const result = await UserService.updateUser(user.id, { name: 'New Name' });
      expect(result.name).toBe('New Name');
    });
  });

  describe('deleteUser', () => {
    it('should delete user', async () => {
      const user = await User.create({
        name: 'To Delete',
        email: 'delete@example.com',
        password: 'password123',
        phone: '0000000000'
      });

      await UserService.deleteUser(user.id);
      const found = await User.findByPk(user.id);
      expect(found).toBeNull();
    });
  });
});
