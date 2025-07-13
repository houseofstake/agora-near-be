import * as borsh from "borsh";
import * as js_sha256 from "js-sha256";
import { utils } from "near-api-js";
import { verifySignature } from "../verifySignature";

// Mock dependencies
jest.mock("borsh");
jest.mock("js-sha256", () => ({
  sha256: {
    array: jest.fn(),
  },
}));
jest.mock("near-api-js");

const mockBorsh = borsh as jest.Mocked<typeof borsh>;
const mockSha256 = js_sha256 as jest.Mocked<typeof js_sha256>;
const mockUtils = utils as jest.Mocked<typeof utils>;

describe("verifySignature", () => {
  // Test data
  const testMessage = "test message";
  const testSignature = "dGVzdCBzaWduYXR1cmU="; // base64 encoded "test signature"
  const testPublicKey = "ed25519:test_public_key";
  const testRecipient = "test-recipient";
  const testNonce = Buffer.from("test-nonce-32-bytes-long-buffer!!");
  const mockSerializedPayload = new Uint8Array([1, 2, 3, 4, 5]);
  const mockHashedPayload = new Uint8Array([6, 7, 8, 9, 10]);
  const mockSignatureBuffer = Buffer.from("test signature");

  // Mock objects
  const mockPublicKeyInstance = {
    verify: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    mockBorsh.serialize.mockReturnValue(mockSerializedPayload);
    (mockSha256.sha256.array as jest.Mock).mockReturnValue(mockHashedPayload);
    mockUtils.PublicKey = {
      fromString: jest.fn().mockReturnValue(mockPublicKeyInstance),
    } as any;
  });

  describe("with valid signature", () => {
    it("should return true when signature is valid", () => {
      mockPublicKeyInstance.verify.mockReturnValue(true);

      const result = verifySignature({
        message: testMessage,
        signature: testSignature,
        publicKey: testPublicKey,
      });

      expect(result).toBe(true);
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
          nonce: expect.any(Buffer),
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

    it("should return true with custom recipient", () => {
      mockPublicKeyInstance.verify.mockReturnValue(true);

      const result = verifySignature({
        message: testMessage,
        signature: testSignature,
        publicKey: testPublicKey,
        recipient: testRecipient,
      });

      expect(result).toBe(true);
      expect(mockBorsh.serialize).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          recipient: testRecipient,
        })
      );
    });

    it("should return true with custom nonce", () => {
      mockPublicKeyInstance.verify.mockReturnValue(true);

      const result = verifySignature({
        message: testMessage,
        signature: testSignature,
        publicKey: testPublicKey,
        nonce: testNonce,
      });

      expect(result).toBe(true);
      expect(mockBorsh.serialize).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          nonce: testNonce,
        })
      );
    });

    it("should return true with both custom recipient and nonce", () => {
      mockPublicKeyInstance.verify.mockReturnValue(true);

      const result = verifySignature({
        message: testMessage,
        signature: testSignature,
        publicKey: testPublicKey,
        recipient: testRecipient,
        nonce: testNonce,
      });

      expect(result).toBe(true);
      expect(mockBorsh.serialize).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          recipient: testRecipient,
          nonce: testNonce,
        })
      );
    });
  });

  describe("with invalid signature", () => {
    it("should return false when signature is invalid", () => {
      mockPublicKeyInstance.verify.mockReturnValue(false);

      const result = verifySignature({
        message: testMessage,
        signature: testSignature,
        publicKey: testPublicKey,
      });

      expect(result).toBe(false);
      expect(mockPublicKeyInstance.verify).toHaveBeenCalledWith(
        mockHashedPayload,
        mockSignatureBuffer
      );
    });
  });

  describe("payload creation", () => {
    it("should create payload with correct tag", () => {
      mockPublicKeyInstance.verify.mockReturnValue(true);

      verifySignature({
        message: testMessage,
        signature: testSignature,
        publicKey: testPublicKey,
      });

      expect(mockBorsh.serialize).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          tag: 2147484061,
        })
      );
    });

    it("should create payload with provided message", () => {
      mockPublicKeyInstance.verify.mockReturnValue(true);
      const customMessage = "custom test message";

      verifySignature({
        message: customMessage,
        signature: testSignature,
        publicKey: testPublicKey,
      });

      expect(mockBorsh.serialize).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          message: customMessage,
        })
      );
    });

    it("should create payload with default values when optional params not provided", () => {
      mockPublicKeyInstance.verify.mockReturnValue(true);

      verifySignature({
        message: testMessage,
        signature: testSignature,
        publicKey: testPublicKey,
      });

      const serializedPayload = mockBorsh.serialize.mock.calls[0][1] as any;
      expect(serializedPayload).toMatchObject({
        tag: 2147484061,
        message: testMessage,
        nonce: expect.any(Buffer),
        recipient: "agora-near-be",
      });
      expect(serializedPayload.callbackUrl).toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("should throw error when borsh serialization fails", () => {
      mockBorsh.serialize.mockImplementation(() => {
        throw new Error("Serialization failed");
      });

      expect(() => {
        verifySignature({
          message: testMessage,
          signature: testSignature,
          publicKey: testPublicKey,
        });
      }).toThrow("Serialization failed");
    });

    it("should throw error when sha256 hashing fails", () => {
      (mockSha256.sha256.array as jest.Mock).mockImplementation(() => {
        throw new Error("Hashing failed");
      });

      expect(() => {
        verifySignature({
          message: testMessage,
          signature: testSignature,
          publicKey: testPublicKey,
        });
      }).toThrow("Hashing failed");
    });

    it("should throw error when PublicKey.fromString fails", () => {
      (mockUtils.PublicKey.fromString as jest.Mock).mockImplementation(() => {
        throw new Error("Invalid public key");
      });

      expect(() => {
        verifySignature({
          message: testMessage,
          signature: testSignature,
          publicKey: "invalid-key",
        });
      }).toThrow("Invalid public key");
    });
  });

  describe("integration scenarios", () => {
    it("should handle empty message", () => {
      mockPublicKeyInstance.verify.mockReturnValue(true);

      const result = verifySignature({
        message: "",
        signature: testSignature,
        publicKey: testPublicKey,
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
    it("should use serialized payload for hashing", () => {
      mockPublicKeyInstance.verify.mockReturnValue(true);

      verifySignature({
        message: testMessage,
        signature: testSignature,
        publicKey: testPublicKey,
      });

      expect(mockSha256.sha256.array).toHaveBeenCalledWith(
        mockSerializedPayload
      );
    });

    it("should use hashed payload for verification", () => {
      mockPublicKeyInstance.verify.mockReturnValue(true);

      verifySignature({
        message: testMessage,
        signature: testSignature,
        publicKey: testPublicKey,
      });

      expect(mockPublicKeyInstance.verify).toHaveBeenCalledWith(
        mockHashedPayload,
        expect.any(Buffer)
      );
    });

    it("should call all required functions during verification", () => {
      mockPublicKeyInstance.verify.mockReturnValue(true);

      verifySignature({
        message: testMessage,
        signature: testSignature,
        publicKey: testPublicKey,
      });

      expect(mockBorsh.serialize).toHaveBeenCalledTimes(1);
      expect(mockSha256.sha256.array).toHaveBeenCalledTimes(1);
      expect(mockUtils.PublicKey.fromString).toHaveBeenCalledTimes(1);
      expect(mockPublicKeyInstance.verify).toHaveBeenCalledTimes(1);
    });
  });
});
