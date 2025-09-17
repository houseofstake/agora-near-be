import request from "supertest";
import axios from "axios";
import app from "../../../app";
import { prismaMock } from "../../../lib/tests/prismaMock";
import { NEAR_BLOCKS_BASE_URL } from "../../../lib/nearBlocks";

// Mock axios
jest.mock("axios");
const mockAxios = axios as jest.Mocked<typeof axios>;

describe("TransactionsController", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation();
    jest.clearAllMocks();
  });

  describe("GET /api/transactions/hash", () => {
    const mockReceiptId = "test-receipt-id-123";
    const mockTransactionHash = "test-transaction-hash-456";

    it("should return 400 for invalid network ID", async () => {
      const response = await request(app)
        .get("/api/transactions/hash")
        .query({ network_id: "invalid", receipt_id: mockReceiptId })
        .expect(400)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Invalid network ID",
      });
    });

    it("should return 400 when receipt ID is missing", async () => {
      const response = await request(app)
        .get("/api/transactions/hash")
        .query({ network_id: "testnet" })
        .expect(400)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Receipt ID is required",
      });
    });

    it("should return cached result when cache entry exists", async () => {
      // Arrange
      const networkId = "testnet";
      const cacheKey = `transaction-hash-${networkId}-${mockReceiptId}`;
      const cachedData = { transactionHash: mockTransactionHash };

      prismaMock.cache.findFirst.mockResolvedValue({
        id: 1,
        key: cacheKey,
        data: cachedData,
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Act & Assert
      const response = await request(app)
        .get("/api/transactions/hash")
        .query({ network_id: networkId, receipt_id: mockReceiptId })
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual(cachedData);
      expect(prismaMock.cache.findFirst).toHaveBeenCalledWith({
        where: {
          key: cacheKey,
        },
      });
      expect(mockAxios.get).not.toHaveBeenCalled();
    });

    it("should fetch from API and cache result when cache miss", async () => {
      // Arrange
      const networkId = "testnet";
      const cacheKey = `transaction-hash-${networkId}-${mockReceiptId}`;
      const expectedResponse = { transactionHash: mockTransactionHash };

      prismaMock.cache.findFirst.mockResolvedValue(null);
      prismaMock.cache.upsert.mockResolvedValue({
        id: 1,
        key: cacheKey,
        data: expectedResponse,
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockAxios.get.mockResolvedValue({
        data: {
          receipts: [
            {
              receipt_id: mockReceiptId,
              originated_from_transaction_hash: mockTransactionHash,
            },
          ],
        },
      });

      // Act & Assert
      const response = await request(app)
        .get("/api/transactions/hash")
        .query({ network_id: networkId, receipt_id: mockReceiptId })
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual(expectedResponse);

      expect(prismaMock.cache.findFirst).toHaveBeenCalledWith({
        where: {
          key: cacheKey,
        },
      });

      expect(mockAxios.get).toHaveBeenCalledWith(
        `${NEAR_BLOCKS_BASE_URL[networkId]}/search/receipts?keyword=${mockReceiptId}`
      );

      expect(prismaMock.cache.upsert).toHaveBeenCalledWith({
        where: { key: cacheKey },
        update: {
          data: expectedResponse,
        },
        create: {
          key: cacheKey,
          data: expectedResponse,
          expiresAt: expect.any(Date),
        },
      });
    });

    it("should return 404 when no transaction hash found in API response", async () => {
      // Arrange
      const networkId = "testnet";

      prismaMock.cache.findFirst.mockResolvedValue(null);

      mockAxios.get.mockResolvedValue({
        data: {
          receipts: [],
        },
      });

      // Act & Assert
      const response = await request(app)
        .get("/api/transactions/hash")
        .query({ network_id: networkId, receipt_id: mockReceiptId })
        .expect(404)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "No transaction hash found for receipt",
      });

      expect(mockAxios.get).toHaveBeenCalledWith(
        `${NEAR_BLOCKS_BASE_URL[networkId]}/search/receipts?keyword=${mockReceiptId}`
      );

      expect(prismaMock.cache.upsert).not.toHaveBeenCalled();
    });

    it("should handle API request error gracefully", async () => {
      // Arrange
      const networkId = "testnet";
      const errorMessage = "Network request failed";

      prismaMock.cache.findFirst.mockResolvedValue(null);
      mockAxios.get.mockRejectedValue(new Error(errorMessage));

      // Act & Assert
      const response = await request(app)
        .get("/api/transactions/hash")
        .query({ network_id: networkId, receipt_id: mockReceiptId })
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Failed to get transaction hash",
      });

      expect(mockAxios.get).toHaveBeenCalledWith(
        `${NEAR_BLOCKS_BASE_URL[networkId]}/search/receipts?keyword=${mockReceiptId}`
      );
    });

    it("should use correct API URL for testnet", async () => {
      // Arrange
      const networkId = "testnet";

      prismaMock.cache.findFirst.mockResolvedValue(null);
      prismaMock.cache.upsert.mockResolvedValue({
        id: 1,
        key: `transaction-hash-${networkId}-${mockReceiptId}`,
        data: { transactionHash: mockTransactionHash },
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockAxios.get.mockResolvedValue({
        data: {
          receipts: [
            {
              receipt_id: mockReceiptId,
              originated_from_transaction_hash: mockTransactionHash,
            },
          ],
        },
      });

      // Act
      await request(app)
        .get("/api/transactions/hash")
        .query({ network_id: networkId, receipt_id: mockReceiptId })
        .expect(200);

      // Assert
      expect(mockAxios.get).toHaveBeenCalledWith(
        `${NEAR_BLOCKS_BASE_URL.testnet}/search/receipts?keyword=${mockReceiptId}`
      );
    });

    it("should use correct API URL for mainnet", async () => {
      // Arrange
      const networkId = "mainnet";

      prismaMock.cache.findFirst.mockResolvedValue(null);
      prismaMock.cache.upsert.mockResolvedValue({
        id: 1,
        key: `transaction-hash-${networkId}-${mockReceiptId}`,
        data: { transactionHash: mockTransactionHash },
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockAxios.get.mockResolvedValue({
        data: {
          receipts: [
            {
              receipt_id: mockReceiptId,
              originated_from_transaction_hash: mockTransactionHash,
            },
          ],
        },
      });

      // Act
      await request(app)
        .get("/api/transactions/hash")
        .query({ network_id: networkId, receipt_id: mockReceiptId })
        .expect(200);

      // Assert
      expect(mockAxios.get).toHaveBeenCalledWith(
        `${NEAR_BLOCKS_BASE_URL.mainnet}/search/receipts?keyword=${mockReceiptId}`
      );
    });
  });
});
