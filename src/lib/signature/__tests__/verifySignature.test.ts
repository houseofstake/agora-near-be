import * as borsh from "borsh";
import * as js_sha256 from "js-sha256";
import { utils } from "near-api-js";
import { verifySignature } from "../verifySignature";
import { retrieveNonceForAccount } from "../nonce";

// Mock dependencies
jest.mock("borsh");
jest.mock("js-sha256", () => ({
  sha256: {
    array: jest.fn(),
  },
}));
jest.mock("near-api-js");
jest.mock("../nonce");
jest.mock("../../utils/rpc");

const mockBorsh = borsh as jest.Mocked<typeof borsh>;
const mockSha256 = js_sha256 as jest.Mocked<typeof js_sha256>;
const mockUtils = utils as jest.Mocked<typeof utils>;
const mockRetrieveNonceForAccount =
  retrieveNonceForAccount as jest.MockedFunction<
    typeof retrieveNonceForAccount
  >;

describe("verifySignature", () => {
  // Test data
  const testMessage = "test message";
  const testSignature = "dGVzdCBzaWduYXR1cmU="; // base64 encoded "test signature"
  const testPublicKey = "ed25519:test_public_key";
  const testAccountId = "test-account.near";
  const testNetworkId = "testnet";
  const testNonce = Buffer.from("test-nonce-32-bytes-long-buffer!!");
  const mockSerializedPayload = new Uint8Array([1, 2, 3, 4, 5]);
  const mockHashedPayload = new Uint8Array([6, 7, 8, 9, 10]);
  const mockSignatureBuffer = Buffer.from("test signature");

  // Mock objects
  const mockPublicKeyInstance = {
    verify: jest.fn(),
  };

  // Mock fetch for verifyFullKeyBelongsToUser
  const mockFetch = jest.fn();
  global.fetch = mockFetch;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    mockBorsh.serialize.mockReturnValue(mockSerializedPayload);
    (mockSha256.sha256.array as jest.Mock).mockReturnValue(mockHashedPayload);
    mockUtils.PublicKey = {
      fromString: jest.fn().mockReturnValue(mockPublicKeyInstance),
    } as any;

    // Mock nonce retrieval
    mockRetrieveNonceForAccount.mockResolvedValue(testNonce);

    // Mock fetch for key verification (successful by default)
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          result: {
            keys: [
              {
                public_key: testPublicKey,
                access_key: {
                  permission: "FullAccess",
                },
              },
            ],
          },
        }),
    });
  });

  describe("with valid signature", () => {
    it("should return true when signature is valid", async () => {
      mockPublicKeyInstance.verify.mockReturnValue(true);

      const result = await verifySignature({
        message: testMessage,
        signature: testSignature,
        publicKey: testPublicKey,
        networkId: testNetworkId,
        accountId: testAccountId,
      });

      expect(result).toBe(true);
      expect(mockRetrieveNonceForAccount).toHaveBeenCalledWith(testAccountId);
      expect(mockFetch).toHaveBeenCalled();
      expect(mockBorsh.serialize).toHaveBeenCalledWith(
        {
          struct: {
            tag: "u32",
            message: "string",
            nonce: { array: { type: "u8", len: 32 } },
            recipient: "string",
            callbackUrl: { option: "string" },
          },
        },
        expect.objectContaining({
          tag: 2147484061,
          message: testMessage,
          nonce: testNonce,
          recipient: "agora-near-be",
        })
      );
      expect(mockSha256.sha256.array).toHaveBeenCalledWith(
        mockSerializedPayload
      );
      expect(mockUtils.PublicKey.fromString).toHaveBeenCalledWith(
        testPublicKey
      );
      expect(mockPublicKeyInstance.verify).toHaveBeenCalledWith(
        mockHashedPayload,
        mockSignatureBuffer
      );
    });

    it("should return false when key verification fails", async () => {
      mockPublicKeyInstance.verify.mockReturnValue(true);
      // Mock key not belonging to user
      mockFetch.mockResolvedValue({
        json: () =>
          Promise.resolve({
            result: {
              keys: [
                {
                  public_key: "different-key",
                  access_key: {
                    permission: "FullAccess",
                  },
                },
              ],
            },
          }),
      });

      const result = await verifySignature({
        message: testMessage,
        signature: testSignature,
        publicKey: testPublicKey,
        networkId: testNetworkId,
        accountId: testAccountId,
      });

      expect(result).toBe(false);
    });

    it("should return false when key has limited access", async () => {
      mockPublicKeyInstance.verify.mockReturnValue(true);
      // Mock key with limited access
      mockFetch.mockResolvedValue({
        json: () =>
          Promise.resolve({
            result: {
              keys: [
                {
                  public_key: testPublicKey,
                  access_key: {
                    permission: "FunctionCall",
                  },
                },
              ],
            },
          }),
      });

      const result = await verifySignature({
        message: testMessage,
        signature: testSignature,
        publicKey: testPublicKey,
        networkId: testNetworkId,
        accountId: testAccountId,
      });

      expect(result).toBe(false);
    });
  });

  describe("with invalid signature", () => {
    it("should return false when signature is invalid", async () => {
      mockPublicKeyInstance.verify.mockReturnValue(false);

      const result = await verifySignature({
        message: testMessage,
        signature: testSignature,
        publicKey: testPublicKey,
        networkId: testNetworkId,
        accountId: testAccountId,
      });

      expect(result).toBe(false);
      expect(mockPublicKeyInstance.verify).toHaveBeenCalledWith(
        mockHashedPayload,
        mockSignatureBuffer
      );
    });
  });

  describe("payload creation", () => {
    it("should create payload with correct tag", async () => {
      mockPublicKeyInstance.verify.mockReturnValue(true);

      await verifySignature({
        message: testMessage,
        signature: testSignature,
        publicKey: testPublicKey,
        networkId: testNetworkId,
        accountId: testAccountId,
      });

      expect(mockBorsh.serialize).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          tag: 2147484061,
        })
      );
    });

    it("should create payload with provided message", async () => {
      mockPublicKeyInstance.verify.mockReturnValue(true);
      const customMessage = "custom test message";

      await verifySignature({
        message: customMessage,
        signature: testSignature,
        publicKey: testPublicKey,
        networkId: testNetworkId,
        accountId: testAccountId,
      });

      expect(mockBorsh.serialize).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          message: customMessage,
        })
      );
    });

    it("should create payload with retrieved nonce", async () => {
      mockPublicKeyInstance.verify.mockReturnValue(true);

      await verifySignature({
        message: testMessage,
        signature: testSignature,
        publicKey: testPublicKey,
        networkId: testNetworkId,
        accountId: testAccountId,
      });

      const serializedPayload = mockBorsh.serialize.mock.calls[0][1] as any;
      expect(serializedPayload).toMatchObject({
        tag: 2147484061,
        message: testMessage,
        nonce: testNonce,
        recipient: "agora-near-be",
      });
      expect(serializedPayload.callbackUrl).toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("should throw error when nonce is not found", async () => {
      mockRetrieveNonceForAccount.mockResolvedValue(null);

      await expect(
        verifySignature({
          message: testMessage,
          signature: testSignature,
          publicKey: testPublicKey,
          networkId: testNetworkId,
          accountId: testAccountId,
        })
      ).rejects.toThrow("No nonce found");
    });

    it("should throw error when borsh serialization fails", async () => {
      mockBorsh.serialize.mockImplementation(() => {
        throw new Error("Serialization failed");
      });

      await expect(
        verifySignature({
          message: testMessage,
          signature: testSignature,
          publicKey: testPublicKey,
          networkId: testNetworkId,
          accountId: testAccountId,
        })
      ).rejects.toThrow("Serialization failed");
    });

    it("should throw error when sha256 hashing fails", async () => {
      (mockSha256.sha256.array as jest.Mock).mockImplementation(() => {
        throw new Error("Hashing failed");
      });

      await expect(
        verifySignature({
          message: testMessage,
          signature: testSignature,
          publicKey: testPublicKey,
          networkId: testNetworkId,
          accountId: testAccountId,
        })
      ).rejects.toThrow("Hashing failed");
    });

    it("should throw error when PublicKey.fromString fails", async () => {
      (mockUtils.PublicKey.fromString as jest.Mock).mockImplementation(() => {
        throw new Error("Invalid public key");
      });

      await expect(
        verifySignature({
          message: testMessage,
          signature: testSignature,
          publicKey: "invalid-key",
          networkId: testNetworkId,
          accountId: testAccountId,
        })
      ).rejects.toThrow("Invalid public key");
    });
  });

  describe("integration scenarios", () => {
    it("should handle empty message", async () => {
      mockPublicKeyInstance.verify.mockReturnValue(true);

      const result = await verifySignature({
        message: "",
        signature: testSignature,
        publicKey: testPublicKey,
        networkId: testNetworkId,
        accountId: testAccountId,
      });

      expect(result).toBe(true);
      expect(mockBorsh.serialize).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          message: "",
        })
      );
    });
  });

  describe("serialization flow", () => {
    it("should use serialized payload for hashing", async () => {
      mockPublicKeyInstance.verify.mockReturnValue(true);

      await verifySignature({
        message: testMessage,
        signature: testSignature,
        publicKey: testPublicKey,
        networkId: testNetworkId,
        accountId: testAccountId,
      });

      expect(mockSha256.sha256.array).toHaveBeenCalledWith(
        mockSerializedPayload
      );
    });

    it("should use hashed payload for verification", async () => {
      mockPublicKeyInstance.verify.mockReturnValue(true);

      await verifySignature({
        message: testMessage,
        signature: testSignature,
        publicKey: testPublicKey,
        networkId: testNetworkId,
        accountId: testAccountId,
      });

      expect(mockPublicKeyInstance.verify).toHaveBeenCalledWith(
        mockHashedPayload,
        expect.any(Buffer)
      );
    });

    it("should call all required functions during verification", async () => {
      mockPublicKeyInstance.verify.mockReturnValue(true);

      await verifySignature({
        message: testMessage,
        signature: testSignature,
        publicKey: testPublicKey,
        networkId: testNetworkId,
        accountId: testAccountId,
      });

      expect(mockRetrieveNonceForAccount).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockBorsh.serialize).toHaveBeenCalledTimes(1);
      expect(mockSha256.sha256.array).toHaveBeenCalledTimes(1);
      expect(mockUtils.PublicKey.fromString).toHaveBeenCalledTimes(1);
      expect(mockPublicKeyInstance.verify).toHaveBeenCalledTimes(1);
    });
  });
});
