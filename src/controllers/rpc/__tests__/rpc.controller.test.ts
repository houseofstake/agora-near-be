import request from "supertest";
import app from "../../../app";
import * as rpcUtils from "../../../lib/utils/rpc";

// Mock fetch globally
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

// Mock the getRpcUrl function
jest.mock("../../../lib/utils/rpc", () => ({
  getRpcUrl: jest.fn(),
}));

const mockGetRpcUrl = rpcUtils.getRpcUrl as jest.MockedFunction<
  typeof rpcUtils.getRpcUrl
>;

describe("RpcController", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation();

    // Clear all mocks before each test
    jest.clearAllMocks();

    // Reset environment variable
    delete process.env.FASTNEAR_API_KEY;
  });

  describe("POST /api/rpc/:networkId", () => {
    const mockRpcRequest = {
      jsonrpc: "2.0",
      id: "dontcare",
      method: "query",
      params: {
        request_type: "view_account",
        finality: "final",
        account_id: "test.near",
      },
    };

    const mockRpcResponse = {
      jsonrpc: "2.0",
      id: "dontcare",
      result: {
        amount: "1000000000000000000000000",
        locked: "0",
        code_hash: "11111111111111111111111111111111",
        storage_usage: 182,
        storage_paid_at: 0,
        block_height: 123456,
        block_hash: "abc123",
      },
    };

    it("should successfully proxy RPC request for mainnet", async () => {
      // Arrange
      const networkId = "mainnet";
      const mockUrl = "https://rpc.mainnet.fastnear.com?apiKey=test-key";

      mockGetRpcUrl.mockReturnValue(mockUrl);
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockRpcResponse),
      } as any);

      // Act & Assert
      const response = await request(app)
        .post(`/api/rpc/${networkId}`)
        .send(mockRpcRequest)
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual(mockRpcResponse);
      expect(mockGetRpcUrl).toHaveBeenCalledWith({ networkId });
      expect(mockFetch).toHaveBeenCalledWith(mockUrl, {
        method: "POST",
        body: JSON.stringify(mockRpcRequest),
        headers: {
          "Content-Type": "application/json",
        },
      });
    });

    it("should successfully proxy RPC request for testnet", async () => {
      // Arrange
      const networkId = "testnet";
      const mockUrl = "https://rpc.testnet.fastnear.com?apiKey=test-key";

      mockGetRpcUrl.mockReturnValue(mockUrl);
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockRpcResponse),
      } as any);

      // Act & Assert
      const response = await request(app)
        .post(`/api/rpc/${networkId}`)
        .send(mockRpcRequest)
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual(mockRpcResponse);
      expect(mockGetRpcUrl).toHaveBeenCalledWith({ networkId });
      expect(mockFetch).toHaveBeenCalledWith(mockUrl, {
        method: "POST",
        body: JSON.stringify(mockRpcRequest),
        headers: {
          "Content-Type": "application/json",
        },
      });
    });

    it("should handle RPC error response", async () => {
      // Arrange
      const networkId = "mainnet";
      const mockUrl = "https://rpc.mainnet.fastnear.com?apiKey=test-key";
      const mockErrorResponse = {
        jsonrpc: "2.0",
        id: "dontcare",
        error: {
          code: -32000,
          message: "Server error",
          data: "Internal server error",
        },
      };

      mockGetRpcUrl.mockReturnValue(mockUrl);
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockErrorResponse),
      } as any);

      // Act & Assert
      const response = await request(app)
        .post(`/api/rpc/${networkId}`)
        .send(mockRpcRequest)
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual(mockErrorResponse);
    });

    it("should return 500 when fetch fails", async () => {
      // Arrange
      const networkId = "mainnet";
      const mockUrl = "https://rpc.mainnet.fastnear.com?apiKey=test-key";

      mockGetRpcUrl.mockReturnValue(mockUrl);
      mockFetch.mockRejectedValue(new Error("Network error"));

      // Act & Assert
      const response = await request(app)
        .post(`/api/rpc/${networkId}`)
        .send(mockRpcRequest)
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "RPC call failed: Error: Network error",
      });
    });

    it("should return 500 when JSON parsing fails", async () => {
      // Arrange
      const networkId = "mainnet";
      const mockUrl = "https://rpc.mainnet.fastnear.com?apiKey=test-key";

      mockGetRpcUrl.mockReturnValue(mockUrl);
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockRejectedValue(new Error("Invalid JSON")),
      } as any);

      // Act & Assert
      const response = await request(app)
        .post(`/api/rpc/${networkId}`)
        .send(mockRpcRequest)
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "RPC call failed: Error: Invalid JSON",
      });
    });

    it("should handle getRpcUrl throwing an error", async () => {
      // Arrange
      const networkId = "mainnet";

      mockGetRpcUrl.mockImplementation(() => {
        throw new Error("Invalid network configuration");
      });

      // Act & Assert
      const response = await request(app)
        .post(`/api/rpc/${networkId}`)
        .send(mockRpcRequest)
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "RPC call failed: Error: Invalid network configuration",
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/archival-rpc/:networkId", () => {
    const mockRpcRequest = {
      jsonrpc: "2.0",
      id: "dontcare",
      method: "block",
      params: {
        block_id: 12345,
      },
    };

    const mockRpcResponse = {
      jsonrpc: "2.0",
      id: "dontcare",
      result: {
        header: {
          height: 12345,
          hash: "abc123",
          timestamp: 1234567890,
        },
        chunks: [],
      },
    };

    it("should successfully proxy archival RPC request for mainnet", async () => {
      // Arrange
      const networkId = "mainnet";
      const mockUrl =
        "https://archival-rpc.mainnet.fastnear.com?apiKey=test-key";

      mockGetRpcUrl.mockReturnValue(mockUrl);
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockRpcResponse),
      } as any);

      // Act & Assert
      const response = await request(app)
        .post(`/api/archival-rpc/${networkId}`)
        .send(mockRpcRequest)
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual(mockRpcResponse);
      expect(mockGetRpcUrl).toHaveBeenCalledWith({
        networkId,
        useArchivalNode: true,
      });
      expect(mockFetch).toHaveBeenCalledWith(mockUrl, {
        method: "POST",
        body: JSON.stringify(mockRpcRequest),
        headers: {
          "Content-Type": "application/json",
        },
      });
    });

    it("should successfully proxy archival RPC request for testnet", async () => {
      // Arrange
      const networkId = "testnet";
      const mockUrl =
        "https://archival-rpc.testnet.fastnear.com?apiKey=test-key";

      mockGetRpcUrl.mockReturnValue(mockUrl);
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockRpcResponse),
      } as any);

      // Act & Assert
      const response = await request(app)
        .post(`/api/archival-rpc/${networkId}`)
        .send(mockRpcRequest)
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual(mockRpcResponse);
      expect(mockGetRpcUrl).toHaveBeenCalledWith({
        networkId,
        useArchivalNode: true,
      });
      expect(mockFetch).toHaveBeenCalledWith(mockUrl, {
        method: "POST",
        body: JSON.stringify(mockRpcRequest),
        headers: {
          "Content-Type": "application/json",
        },
      });
    });

    it("should handle archival RPC error response", async () => {
      // Arrange
      const networkId = "mainnet";
      const mockUrl =
        "https://archival-rpc.mainnet.fastnear.com?apiKey=test-key";
      const mockErrorResponse = {
        jsonrpc: "2.0",
        id: "dontcare",
        error: {
          code: -32600,
          message: "Invalid request",
          data: "Block not found",
        },
      };

      mockGetRpcUrl.mockReturnValue(mockUrl);
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockErrorResponse),
      } as any);

      // Act & Assert
      const response = await request(app)
        .post(`/api/archival-rpc/${networkId}`)
        .send(mockRpcRequest)
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual(mockErrorResponse);
    });

    it("should return 500 when archival fetch fails", async () => {
      // Arrange
      const networkId = "mainnet";
      const mockUrl =
        "https://archival-rpc.mainnet.fastnear.com?apiKey=test-key";

      mockGetRpcUrl.mockReturnValue(mockUrl);
      mockFetch.mockRejectedValue(new Error("Archival node unavailable"));

      // Act & Assert
      const response = await request(app)
        .post(`/api/archival-rpc/${networkId}`)
        .send(mockRpcRequest)
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "RPC call failed: Error: Archival node unavailable",
      });
    });

    it("should return 500 when archival JSON parsing fails", async () => {
      // Arrange
      const networkId = "mainnet";
      const mockUrl =
        "https://archival-rpc.mainnet.fastnear.com?apiKey=test-key";

      mockGetRpcUrl.mockReturnValue(mockUrl);
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockRejectedValue(new Error("Malformed response")),
      } as any);

      // Act & Assert
      const response = await request(app)
        .post(`/api/archival-rpc/${networkId}`)
        .send(mockRpcRequest)
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "RPC call failed: Error: Malformed response",
      });
    });

    it("should handle getRpcUrl throwing an error for archival", async () => {
      // Arrange
      const networkId = "mainnet";

      mockGetRpcUrl.mockImplementation(() => {
        throw new Error("Archival configuration error");
      });

      // Act & Assert
      const response = await request(app)
        .post(`/api/archival-rpc/${networkId}`)
        .send(mockRpcRequest)
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "RPC call failed: Error: Archival configuration error",
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
