/**
 * src/modules/sessions/session.model.test.js
 */
import { Session, User } from '../../models/index.js';

describe("SessionModel", () => {
  let user;
  beforeAll(async () => {
    user = await User.create({ name: "Session User", email: "s@example.com" });
  });
  beforeEach(async () => {
    await Session.destroy({ where: {} });
  });

  it("should create a session with default title", async () => {
    const session = await Session.create({ userId: user.id });
    expect(session.title).toBe("New conversation");
  });

  it("should require a userId", async () => {
    await expect(Session.create({ title: "No User" })).rejects.toThrow();
  });
});
