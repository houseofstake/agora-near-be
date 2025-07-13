import request from "supertest";
import app from "../../../app";
import { prismaMock } from "../../../lib/tests/prismaMock";

// Mock fetch globally
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe("NearController", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation();

    // Clear all mocks before each test
    jest.clearAllMocks();

    // Reset environment variable
    delete process.env.COIN_GECKO_API_KEY;
  });

  describe("GET /api/near/price", () => {
    it("should return cached price when valid cache exists", async () => {
      // Arrange
      const cachedPrice = {
        price: 4.25,
        currency: "USD",
        lastUpdated: "2024-01-01T12:00:00.000Z",
      };

      const mockCacheEntry = {
        id: 1,
        key: "near-usd-price",
        data: cachedPrice,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaMock.cache.findFirst.mockResolvedValue(mockCacheEntry);

      // Act & Assert
      const response = await request(app)
        .get("/api/near/price")
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual(cachedPrice);
      expect(prismaMock.cache.findFirst).toHaveBeenCalledWith({
        where: {
          key: "near-usd-price",
          expiresAt: {
            gt: expect.any(Date),
          },
        },
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should return 500 when API key is missing", async () => {
      // Arrange
      prismaMock.cache.findFirst.mockResolvedValue(null);

      // Act & Assert
      const response = await request(app)
        .get("/api/near/price")
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Failed to fetch NEAR price",
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should fetch from API and cache when no valid cache exists", async () => {
      // Arrange
      const apiKey = "test-api-key";
      process.env.COIN_GECKO_API_KEY = apiKey;

      const mockApiResponse = {
        market_data: {
          current_price: {
            usd: 4.5,
          },
        },
      };

      prismaMock.cache.findFirst.mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockApiResponse),
      } as any);

      const mockUpsertResult = {
        id: 1,
        key: "near-usd-price",
        data: {
          price: 4.5,
          currency: "USD",
          lastUpdated: expect.any(String),
        },
        expiresAt: expect.any(Date),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaMock.cache.upsert.mockResolvedValue(mockUpsertResult);

      // Act & Assert
      const response = await request(app)
        .get("/api/near/price")
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        price: 4.5,
        currency: "USD",
        lastUpdated: expect.any(String),
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.coingecko.com/api/v3/coins/near",
        {
          method: "GET",
          headers: {
            "x-cg-demo-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      expect(prismaMock.cache.upsert).toHaveBeenCalledWith({
        where: { key: "near-usd-price" },
        update: {
          data: {
            price: 4.5,
            currency: "USD",
            lastUpdated: expect.any(String),
          },
          expiresAt: expect.any(Date),
        },
        create: {
          key: "near-usd-price",
          data: {
            price: 4.5,
            currency: "USD",
            lastUpdated: expect.any(String),
          },
          expiresAt: expect.any(Date),
        },
      });
    });

    it("should return 500 when API request fails", async () => {
      // Arrange
      const apiKey = "test-api-key";
      process.env.COIN_GECKO_API_KEY = apiKey;

      prismaMock.cache.findFirst.mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
      } as any);

      // Act & Assert
      const response = await request(app)
        .get("/api/near/price")
        .expect(429)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Failed to fetch NEAR price",
      });
      expect(prismaMock.cache.upsert).not.toHaveBeenCalled();
    });

    it("should return 500 when API response is invalid", async () => {
      // Arrange
      const apiKey = "test-api-key";
      process.env.COIN_GECKO_API_KEY = apiKey;

      const mockApiResponse = {
        market_data: {
          current_price: {
            // Missing USD price
          },
        },
      };

      prismaMock.cache.findFirst.mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockApiResponse),
      } as any);

      // Act & Assert
      const response = await request(app)
        .get("/api/near/price")
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Failed to fetch NEAR price",
      });
      expect(prismaMock.cache.upsert).not.toHaveBeenCalled();
    });

    it("should return 500 when API response has non-number USD price", async () => {
      // Arrange
      const apiKey = "test-api-key";
      process.env.COIN_GECKO_API_KEY = apiKey;

      const mockApiResponse = {
        market_data: {
          current_price: {
            usd: "invalid-price",
          },
        },
      };

      prismaMock.cache.findFirst.mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockApiResponse),
      } as any);

      // Act & Assert
      const response = await request(app)
        .get("/api/near/price")
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Failed to fetch NEAR price",
      });
      expect(prismaMock.cache.upsert).not.toHaveBeenCalled();
    });

    it("should handle fetch throwing an error", async () => {
      // Arrange
      const apiKey = "test-api-key";
      process.env.COIN_GECKO_API_KEY = apiKey;

      prismaMock.cache.findFirst.mockResolvedValue(null);
      mockFetch.mockRejectedValue(new Error("Network error"));

      // Act & Assert
      const response = await request(app)
        .get("/api/near/price")
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Failed to fetch NEAR price",
        details: "Network error",
      });
      expect(prismaMock.cache.upsert).not.toHaveBeenCalled();
    });

    it("should handle cache.findFirst throwing an error", async () => {
      // Arrange
      prismaMock.cache.findFirst.mockRejectedValue(new Error("Database error"));

      // Act & Assert
      const response = await request(app)
        .get("/api/near/price")
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Failed to fetch NEAR price",
        details: "Database error",
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should handle cache.upsert throwing an error", async () => {
      // Arrange
      const apiKey = "test-api-key";
      process.env.COIN_GECKO_API_KEY = apiKey;

      const mockApiResponse = {
        market_data: {
          current_price: {
            usd: 4.5,
          },
        },
      };

      prismaMock.cache.findFirst.mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockApiResponse),
      } as any);
      prismaMock.cache.upsert.mockRejectedValue(new Error("Database error"));

      // Act & Assert
      const response = await request(app)
        .get("/api/near/price")
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Failed to fetch NEAR price",
        details: "Database error",
      });
    });

    it("should handle JSON parsing error", async () => {
      // Arrange
      const apiKey = "test-api-key";
      process.env.COIN_GECKO_API_KEY = apiKey;

      prismaMock.cache.findFirst.mockResolvedValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockRejectedValue(new Error("Invalid JSON")),
      } as any);

      // Act & Assert
      const response = await request(app)
        .get("/api/near/price")
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Failed to fetch NEAR price",
        details: "Invalid JSON",
      });
      expect(prismaMock.cache.upsert).not.toHaveBeenCalled();
    });
  });

  describe("cleanupExpiredCache", () => {
    it("should delete expired cache entries successfully", async () => {
      // Arrange
      const mockDeleteResult = { count: 5 };
      prismaMock.cache.deleteMany.mockResolvedValue(mockDeleteResult);

      // Import the controller to test the method directly
      const { NearController } = require("../near.controller");
      const controller = new NearController();

      // Act
      await controller.cleanupExpiredCache();

      // Assert
      expect(prismaMock.cache.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: {
            lt: expect.any(Date),
          },
        },
      });
    });

    it("should handle database error gracefully", async () => {
      // Arrange
      const errorMessage = "Database connection failed";
      prismaMock.cache.deleteMany.mockRejectedValue(new Error(errorMessage));

      // Import the controller to test the method directly
      const { NearController } = require("../near.controller");
      const controller = new NearController();

      // Act
      await controller.cleanupExpiredCache();

      // Assert
      expect(prismaMock.cache.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: {
            lt: expect.any(Date),
          },
        },
      });
      expect(console.error).toHaveBeenCalledWith(
        "Error cleaning up expired cache entries:",
        expect.any(Error)
      );
    });
  });
});
