/**
 * src/modules/users/user.model.test.js
 */
import { User } from '../../models/index.js';

describe("UserModel", () => {
  beforeEach(async () => {
    await User.destroy({ where: {} });
  });

  it("should create a valid user", async () => {
    const user = await User.create({ name: "Test User", email: "test@example.com" });
    expect(user.id).toBeDefined();
    expect(user.name).toBe("Test User");
  });

  it("should enforce unique email constraint", async () => {
    await User.create({ name: "User 1", email: "unique@example.com" });
    await expect(User.create({ name: "User 2", email: "unique@example.com" })).rejects.toThrow();
  });

  it("should hash the password on save", async () => {
    const user = await User.create({ name: "Hash Test", email: "hash@example.com", password: "secretpassword" });
    expect(user.password).toBeDefined();
    expect(user.password).not.toBe("secretpassword");
  });

  it("should verify correct password", async () => {
    const user = await User.create({ name: "Verify", email: "v@example.com", password: "mypassword" });
    expect(await user.correctPassword("mypassword", user.password)).toBe(true);
    expect(await user.correctPassword("wrongpassword", user.password)).toBe(false);
  });

  it("should strip password in toSafeJSON", async () => {
    const user = await User.create({ name: "JSON Test", email: "j@example.com", password: "some" });
    const safeUser = user.toSafeJSON();
    expect(safeUser.password).toBeUndefined();
    expect(safeUser.hasPassword).toBe(true);
  });
});
