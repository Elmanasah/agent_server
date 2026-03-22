/**
 * src/modules/documents/document.model.test.js
 */
import { Document, User } from '../../models/index.js';

describe("DocumentModel", () => {
  let user;
  beforeAll(async () => {
    user = await User.create({ name: "Doc User", email: "d@example.com" });
  });
  beforeEach(async () => {
    await Document.destroy({ where: {} });
  });

  it("should create a valid Document", async () => {
    const doc = await Document.create({ fileName: "test.pdf", mimeType: "application/pdf", userId: user.id });
    expect(doc.fileName).toBe("test.pdf");
    expect(doc.chunkIds).toEqual([]);
  });
});
