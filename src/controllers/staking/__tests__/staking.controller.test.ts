import request from "supertest";
import app from "../../../app";
import { prismaMock } from "../../../lib/tests/prismaMock";
import { providers } from "near-api-js";

// Mock external dependencies
jest.mock("../../../lib/staking/fetchPriceAtBlock");
jest.mock("../../../lib/utils/rpc");
jest.mock("near-api-js");

import { fetchPriceAtBlock } from "../../../lib/staking/fetchPriceAtBlock";
import { getRpcUrl } from "../../../lib/utils/rpc";

const mockFetchPriceAtBlock = fetchPriceAtBlock as jest.MockedFunction<
  typeof fetchPriceAtBlock
>;
const mockGetRpcUrl = getRpcUrl as jest.MockedFunction<typeof getRpcUrl>;
const mockProviders = providers as jest.Mocked<typeof providers>;

describe("StakingController", () => {
  let mockProvider: any;

  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation();

    // Clear all mocks before each test
    jest.clearAllMocks();

    // Setup mock provider
    mockProvider = {
      query: jest.fn(),
    };
    mockProviders.JsonRpcProvider.mockImplementation(() => mockProvider);
  });

  describe("GET /api/staking/apy", () => {
    const mockBlockData = {
      height: BigInt(100000000),
    };

    beforeEach(() => {
      mockGetRpcUrl.mockReturnValue("https://rpc.testnet.near.org");
      prismaMock.blocks.findFirst.mockResolvedValue(mockBlockData);
    });

    it("should calculate APY for MetaPool contract (meta-v2.pool.testnet)", async () => {
      // Arrange
      const networkId = "testnet";
      const contractId = "meta-v2.pool.testnet";
      const currentPrice = 1.1;
      const pastPrice = 1.05;
      const expectedAPY = currentPrice / pastPrice - 1; // 0.047619... (MetaPool rate is already annualized)

      mockFetchPriceAtBlock
        .mockResolvedValueOnce(currentPrice)
        .mockResolvedValueOnce(pastPrice);

      // Act & Assert
      const response = await request(app)
        .get("/api/staking/apy")
        .query({ networkId, contractId })
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        apy: expectedAPY,
      });

      expect(mockGetRpcUrl).toHaveBeenCalledWith({
        networkId,
        useArchivalNode: true,
      });
      expect(mockProviders.JsonRpcProvider).toHaveBeenCalledWith({
        url: "https://rpc.testnet.near.org",
      });
      expect(prismaMock.blocks.findFirst).toHaveBeenCalledWith({
        select: {
          height: true,
        },
        where: {
          timestamp: {
            lte: expect.any(String),
          },
        },
        orderBy: {
          timestamp: "desc",
        },
        take: 1,
      });
      expect(mockFetchPriceAtBlock).toHaveBeenCalledTimes(2);
      expect(mockFetchPriceAtBlock).toHaveBeenNthCalledWith(
        1,
        mockProvider,
        contractId,
        "get_st_near_price"
      );
      expect(mockFetchPriceAtBlock).toHaveBeenNthCalledWith(
        2,
        mockProvider,
        contractId,
        "get_st_near_price",
        Number(mockBlockData.height)
      );
    });

    it("should calculate APY for MetaPool contract (meta-pool.near)", async () => {
      // Arrange
      const networkId = "mainnet";
      const contractId = "meta-pool.near";
      const currentPrice = 1.08;
      const pastPrice = 1.02;
      const expectedAPY = currentPrice / pastPrice - 1;

      mockFetchPriceAtBlock
        .mockResolvedValueOnce(currentPrice)
        .mockResolvedValueOnce(pastPrice);

      // Act & Assert
      const response = await request(app)
        .get("/api/staking/apy")
        .query({ networkId, contractId })
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        apy: expectedAPY,
      });

      expect(mockFetchPriceAtBlock).toHaveBeenNthCalledWith(
        1,
        mockProvider,
        contractId,
        "get_st_near_price"
      );
      expect(mockFetchPriceAtBlock).toHaveBeenNthCalledWith(
        2,
        mockProvider,
        contractId,
        "get_st_near_price",
        Number(mockBlockData.height)
      );
    });

    it("should calculate APY for liNEAR contract", async () => {
      // Arrange
      const networkId = "mainnet";
      const contractId = "linear-protocol.near";
      const currentPrice = 1.05;
      const pastPrice = 1.02;
      const rate = currentPrice / pastPrice - 1;
      const expectedAPY = Math.pow(1 + rate, 365 / 25) - 1; // Annualized

      mockFetchPriceAtBlock
        .mockResolvedValueOnce(currentPrice)
        .mockResolvedValueOnce(pastPrice);

      // Act & Assert
      const response = await request(app)
        .get("/api/staking/apy")
        .query({ networkId, contractId })
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        apy: expectedAPY,
      });

      expect(mockFetchPriceAtBlock).toHaveBeenNthCalledWith(
        1,
        mockProvider,
        contractId,
        "ft_price"
      );
      expect(mockFetchPriceAtBlock).toHaveBeenNthCalledWith(
        2,
        mockProvider,
        contractId,
        "ft_price",
        Number(mockBlockData.height)
      );
    });

    it("should handle database query for correct date range for MetaPool (365 days)", async () => {
      // Arrange
      const networkId = "testnet";
      const contractId = "meta-v2.pool.testnet";
      const currentDate = new Date("2024-01-01T00:00:00.000Z");
      const expectedTargetDate = new Date(currentDate);
      expectedTargetDate.setDate(expectedTargetDate.getDate() - 365);

      // Use Jest fake timers to set the system time
      jest.useFakeTimers();
      jest.setSystemTime(currentDate);

      mockFetchPriceAtBlock
        .mockResolvedValueOnce(1.1)
        .mockResolvedValueOnce(1.05);

      // Act
      await request(app)
        .get("/api/staking/apy")
        .query({ networkId, contractId })
        .expect(200);

      // Assert
      expect(prismaMock.blocks.findFirst).toHaveBeenCalledWith({
        select: {
          height: true,
        },
        where: {
          timestamp: {
            lte: expectedTargetDate.toISOString(),
          },
        },
        orderBy: {
          timestamp: "desc",
        },
        take: 1,
      });

      // Restore real timers
      jest.useRealTimers();
    });

    it("should handle database query for correct date range for liNEAR (25 days)", async () => {
      // Arrange
      const networkId = "mainnet";
      const contractId = "linear-protocol.near";
      const currentDate = new Date("2024-01-01T00:00:00.000Z");
      const expectedTargetDate = new Date(currentDate);
      expectedTargetDate.setDate(expectedTargetDate.getDate() - 25);

      // Use Jest fake timers to set the system time
      jest.useFakeTimers();
      jest.setSystemTime(currentDate);

      mockFetchPriceAtBlock
        .mockResolvedValueOnce(1.05)
        .mockResolvedValueOnce(1.02);

      // Act
      await request(app)
        .get("/api/staking/apy")
        .query({ networkId, contractId })
        .expect(200);

      // Assert
      expect(prismaMock.blocks.findFirst).toHaveBeenCalledWith({
        select: {
          height: true,
        },
        where: {
          timestamp: {
            lte: expectedTargetDate.toISOString(),
          },
        },
        orderBy: {
          timestamp: "desc",
        },
        take: 1,
      });

      // Restore real timers
      jest.useRealTimers();
    });

    it("should handle database error gracefully", async () => {
      // Arrange
      const networkId = "testnet";
      const contractId = "meta-v2.pool.testnet";
      const errorMessage = "Database connection failed";

      prismaMock.blocks.findFirst.mockRejectedValue(new Error(errorMessage));

      // Act & Assert
      const response = await request(app)
        .get("/api/staking/apy")
        .query({ networkId, contractId })
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: `RPC call failed: Error: ${errorMessage}`,
      });
    });

    it("should handle RPC URL error gracefully", async () => {
      // Arrange
      const networkId = "testnet";
      const contractId = "meta-v2.pool.testnet";
      const errorMessage = "Invalid network ID";

      mockGetRpcUrl.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      // Act & Assert
      const response = await request(app)
        .get("/api/staking/apy")
        .query({ networkId, contractId })
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: `RPC call failed: Error: ${errorMessage}`,
      });
    });

    it("should handle current price fetch error gracefully", async () => {
      // Arrange
      const networkId = "testnet";
      const contractId = "meta-v2.pool.testnet";
      const errorMessage = "Failed to fetch current price";

      mockFetchPriceAtBlock.mockRejectedValue(new Error(errorMessage));

      // Act & Assert
      const response = await request(app)
        .get("/api/staking/apy")
        .query({ networkId, contractId })
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: `RPC call failed: Error: ${errorMessage}`,
      });
    });

    it("should handle historical price fetch error gracefully", async () => {
      // Arrange
      const networkId = "testnet";
      const contractId = "meta-v2.pool.testnet";
      const errorMessage = "Failed to fetch historical price";

      mockFetchPriceAtBlock
        .mockResolvedValueOnce(1.1)
        .mockRejectedValue(new Error(errorMessage));

      // Act & Assert
      const response = await request(app)
        .get("/api/staking/apy")
        .query({ networkId, contractId })
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: `RPC call failed: Error: ${errorMessage}`,
      });
    });

    it("should handle error querying blocks", async () => {
      // Arrange
      const networkId = "testnet";
      const contractId = "meta-v2.pool.testnet";
      const errorMessage = "Promise.all failed";

      // Make the first promise (database query) reject
      prismaMock.blocks.findFirst.mockRejectedValue(new Error(errorMessage));

      // Act & Assert
      const response = await request(app)
        .get("/api/staking/apy")
        .query({ networkId, contractId })
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: `RPC call failed: Error: ${errorMessage}`,
      });
    });

    it("should handle zero price division gracefully", async () => {
      // Arrange
      const networkId = "testnet";
      const contractId = "meta-v2.pool.testnet";
      const currentPrice = 1.1;
      const pastPrice = 0; // This would cause division by zero

      mockFetchPriceAtBlock
        .mockResolvedValueOnce(currentPrice)
        .mockResolvedValueOnce(pastPrice);

      // Act & Assert
      const response = await request(app)
        .get("/api/staking/apy")
        .query({ networkId, contractId })
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        apy: null,
      });
    });
  });
});
