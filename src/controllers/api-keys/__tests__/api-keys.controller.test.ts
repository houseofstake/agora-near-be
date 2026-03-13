import request from "supertest";
import app from "../../../app";
import { prismaMock } from "../../../lib/tests/prismaMock";
import { verifySignedPayload } from "../../../lib/signature/verifySignature";

jest.mock("../../../lib/signature/verifySignature");

const mockVerifySignedPayload = verifySignedPayload as jest.MockedFunction<
  typeof verifySignedPayload
>;

describe("ApiKeysController", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation();
    jest.clearAllMocks();
  });

  describe("POST /api-keys/list", () => {
    it("should return a list of API keys for the verified user", async () => {
      const mockAccountId = "test.near";
      mockVerifySignedPayload.mockResolvedValue(true);

      const mockApiKeys = [
        {
          id: "key_1",
          keyHint: "hos_live_abcd...",
          email: "test@example.com",
          scopes: ["full"],
          metadata: {},
          lastUsedAt: null,
          createdAt: new Date("2024-01-01T00:00:00.000Z"),
        },
      ];

      prismaMock.api_keys.findMany.mockResolvedValue(mockApiKeys as any);

      const response = await request(app)
        .post("/api/api-keys/list")
        .send({
          signature: "valid_signature",
          publicKey: "valid_pubkey",
          message: "verify_me",
          data: { accountId: mockAccountId },
        })
        .expect(200);

      expect(response.body).toEqual([
        {
          id: "key_1",
          keyHint: "hos_live_abcd...",
          email: "test@example.com",
          scopes: ["full"],
          metadata: {},
          lastUsedAt: null,
          createdAt: "2024-01-01T00:00:00.000Z",
        },
      ]);
      expect(prismaMock.api_keys.findMany).toHaveBeenCalledWith({
        where: { accountId: mockAccountId },
        select: expect.any(Object),
        orderBy: { createdAt: "desc" },
      });
    });

    it("should return 401 if signature validation fails", async () => {
      mockVerifySignedPayload.mockResolvedValue(false);

      // Act
      const response = await request(app)
        .post("/api/api-keys/list")
        .send({
          signature: "invalid_signature",
          publicKey: "invalid_pubkey",
          message: "verify_me",
          data: { accountId: "test.near" },
        })
        .expect(401);

      expect(response.body).toEqual({ error: "Invalid signature" });
      expect(prismaMock.api_keys.findMany).not.toHaveBeenCalled();
    });
  });

  describe("POST /api-keys", () => {
    it("should generate a new API key securely and return the plain text once", async () => {
      const mockAccountId = "test.near";
      const mockEmail = "developer@example.com";
      mockVerifySignedPayload.mockResolvedValue(true);

      const mockCreatedKey = {
        id: "key_123",
        accountId: mockAccountId,
        keyHint: "hos_live_1234...",
        keyHash: "hashed_value_placeholder",
        email: mockEmail,
        scopes: ["full"],
        metadata: {},
        lastUsedAt: null,
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-01-01T00:00:00.000Z"),
      };

      prismaMock.api_keys.create.mockResolvedValue(mockCreatedKey as any);

      const response = await request(app)
        .post("/api/api-keys")
        .send({
          signature: "valid_signature",
          publicKey: "valid_pubkey",
          message: "verify_me",
          data: { accountId: mockAccountId, email: mockEmail },
        })
        .expect(201);

      expect(response.body).toHaveProperty("id", "key_123");
      expect(response.body).toHaveProperty("plainTextKey");
      expect(response.body.plainTextKey).toMatch(/^hos_live_[a-f0-9]{64}$/);
      expect(response.body).toHaveProperty("keyHint", "hos_live_1234...");
      expect(response.body.scopes).toEqual(["full"]);

      const createCallArgs = prismaMock.api_keys.create.mock.calls[0][0];
      expect(createCallArgs.data.keyHash).not.toEqual(
        response.body.plainTextKey,
      );
      expect(createCallArgs.data.keyHash.length).toBeGreaterThan(0);
    });

    it("should require an email to generate a key", async () => {
      mockVerifySignedPayload.mockResolvedValue(true);

      // Act
      const response = await request(app)
        .post("/api/api-keys")
        .send({
          signature: "valid_signature",
          publicKey: "valid_pubkey",
          message: "verify_me",
          data: { accountId: "test.near" },
        })
        .expect(400);

      expect(response.body).toEqual({ error: "Email is required." });
      expect(prismaMock.api_keys.create).not.toHaveBeenCalled();
    });
  });

  describe("POST /api-keys/:id/revoke", () => {
    it("should delete an API key if it belongs to the user", async () => {
      const mockAccountId = "test.near";
      const mockKeyId = "key_to_delete";
      mockVerifySignedPayload.mockResolvedValue(true);

      prismaMock.api_keys.findFirst.mockResolvedValue({
        id: mockKeyId,
        accountId: mockAccountId,
      } as any);
      prismaMock.api_keys.delete.mockResolvedValue({} as any);

      const response = await request(app)
        .post(`/api/api-keys/${mockKeyId}/revoke`)
        .send({
          signature: "valid_signature",
          publicKey: "valid_pubkey",
          message: "verify_me",
          data: { accountId: mockAccountId },
        })
        .expect(200);

      expect(response.body).toEqual({
        message: "API key revoked successfully",
      });
      expect(prismaMock.api_keys.delete).toHaveBeenCalledWith({
        where: { id: mockKeyId },
      });
    });

    it("should return 404 if the API key does not exist or belongs to someone else", async () => {
      const mockAccountId = "test.near";
      const mockKeyId = "foreign_key";
      mockVerifySignedPayload.mockResolvedValue(true);

      prismaMock.api_keys.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/api-keys/${mockKeyId}/revoke`)
        .send({
          signature: "valid_signature",
          publicKey: "valid_pubkey",
          message: "verify_me",
          data: { accountId: mockAccountId },
        })
        .expect(404);

      expect(response.body).toEqual({
        error: "API key not found or unauthorized",
      });
      expect(prismaMock.api_keys.delete).not.toHaveBeenCalled();
    });
  });
  describe("PATCH /api-keys/:id", () => {
    it("should update scopes of an existing key", async () => {
      const mockAccountId = "test.near";
      const mockKeyId = "key_to_update";
      mockVerifySignedPayload.mockResolvedValue(true);

      prismaMock.api_keys.findFirst.mockResolvedValue({
        id: mockKeyId,
        accountId: mockAccountId,
        scopes: ["full"],
      } as any);

      prismaMock.api_keys.update.mockResolvedValue({
        id: mockKeyId,
        accountId: mockAccountId,
        scopes: ["read:forum", "write:vote"],
      } as any);

      const response = await request(app)
        .patch(`/api/api-keys/${mockKeyId}`)
        .send({
          signature: "valid_signature",
          publicKey: "valid_pubkey",
          message: "verify_me",
          data: { accountId: mockAccountId, scopes: ["read:forum", "write:vote"] },
        })
        .expect(200);

      expect(response.body).toEqual({
        message: "API key scopes updated successfully",
        scopes: ["read:forum", "write:vote"],
      });
      expect(prismaMock.api_keys.update).toHaveBeenCalledWith({
        where: { id: mockKeyId },
        data: { scopes: ["read:forum", "write:vote"] },
      });
    });

    it("should return 400 if scopes is not an array", async () => {
      mockVerifySignedPayload.mockResolvedValue(true);

      const response = await request(app)
        .patch(`/api/api-keys/some_key`)
        .send({
          signature: "valid_signature",
          publicKey: "valid_pubkey",
          message: "verify_me",
          data: { accountId: "test.near", scopes: "invalid_string" },
        })
        .expect(400);

      expect(response.body).toEqual({ error: "Scopes must be an array." });
      expect(prismaMock.api_keys.update).not.toHaveBeenCalled();
    });
  });
});
