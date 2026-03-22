/**
 * src/modules/chat/message.model.test.js
 */
import { Message, Session, User } from '../../models/index.js';

describe("MessageModel", () => {
  let user, session;

  beforeAll(async () => {
    user = await User.create({ name: "Message User", email: "m@example.com" });
    session = await Session.create({ userId: user.id });
  });
  beforeEach(async () => {
    await Message.destroy({ where: {} });
  });

  it("should create a message valid parts and role", async () => {
    const msg = await Message.create({ role: "user", parts: [{ text: "Hi" }], sessionId: session.id });
    expect(msg.role).toBe("user");
    expect(msg.parts).toEqual([{ text: "Hi" }]);
  });

  it("should require role, parts, and sessionId", async () => {
    await expect(Message.create({ role: "user", parts: [] })).rejects.toThrow();
    await expect(Message.create({ parts: [], sessionId: session.id })).rejects.toThrow();
    await expect(Message.create({ role: "user", sessionId: session.id })).rejects.toThrow();
  });
});
