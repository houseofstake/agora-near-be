import { Request, Response, NextFunction } from "express";
import { apiKeyAuth, ApiKeyRequest } from "../apiKeyAuth";
import { prisma } from "../../index";

jest.mock("../../index", () => ({
  prisma: {
    api_keys: {
      findFirst: jest.fn(),
    },
  },
}));

describe("apiKeyAuth Middleware", () => {
  let req: Partial<ApiKeyRequest>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      headers: {},
      originalUrl: "/v1/test",
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  it("should return 401 if missing x-api-key header", async () => {
    const middleware = apiKeyAuth();
    await middleware(req as ApiKeyRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Unauthorized" })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 401 if API key is invalid or not found", async () => {
    req.headers!["x-api-key"] = "invalid_key";
    (prisma.api_keys.findFirst as jest.Mock).mockResolvedValue(null);

    const middleware = apiKeyAuth();
    await middleware(req as ApiKeyRequest, res as Response, next);

    expect(prisma.api_keys.findFirst).toHaveBeenCalledWith({
      where: { key: "invalid_key" },
    });
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Invalid API Key" })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("should call next() if key is valid", async () => {
    req.headers!["x-api-key"] = "valid_key";
    (prisma.api_keys.findFirst as jest.Mock).mockResolvedValue({
      id: "key_1",
      accountId: "atom.near",
      key: "valid_key",
    });

    const middleware = apiKeyAuth();
    await middleware(req as ApiKeyRequest, res as Response, next);

    expect(req.user).toEqual({
      accountId: "atom.near",
      keyId: "key_1",
    });
    expect(next).toHaveBeenCalledTimes(1);
  });
});
