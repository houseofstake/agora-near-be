import { Request, Response, NextFunction } from "express";
import { apiKeyAuth, ApiKeyRequest } from "../apiKeyAuth";
import { prisma } from "../../index";
import crypto from "crypto";

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

  const hashApiKey = (key: string) =>
    crypto.createHash("sha256").update(key).digest("hex");

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
      where: { keyHash: hashApiKey("invalid_key") },
    });
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Invalid API Key" })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 403 if API key lacks required scopes (and is not full_access)", async () => {
    req.headers!["x-api-key"] = "valid_key";
    (prisma.api_keys.findFirst as jest.Mock).mockResolvedValue({
      id: "key_1",
      accountId: "atom.near",
      scopes: ["read:forum"],
      keyHint: "hos_...",
    });

    // Endpoint requires write:vote, but key only has read:forum
    const middleware = apiKeyAuth(["write:vote"]);
    await middleware(req as ApiKeyRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Forbidden" })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("should call next() if route requires no specific scopes and key is valid", async () => {
    req.headers!["x-api-key"] = "valid_key";
    (prisma.api_keys.findFirst as jest.Mock).mockResolvedValue({
      id: "key_1",
      accountId: "atom.near",
      scopes: ["read:forum"],
      keyHint: "hos_...",
    });

    const middleware = apiKeyAuth(); // No required scopes
    await middleware(req as ApiKeyRequest, res as Response, next);

    expect(req.user).toEqual({
      accountId: "atom.near",
      keyId: "key_1",
      scopes: ["read:forum"],
    });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should call next() if key has specific required scope", async () => {
    req.headers!["x-api-key"] = "valid_key";
    (prisma.api_keys.findFirst as jest.Mock).mockResolvedValue({
      id: "key_1",
      accountId: "atom.near",
      scopes: ["write:vote", "read:forum"],
      keyHint: "hos_...",
    });

    const middleware = apiKeyAuth(["write:vote"]);
    await middleware(req as ApiKeyRequest, res as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should call next() if key has 'full' or 'full_access' scope, even if it lacks the specific scope", async () => {
    req.headers!["x-api-key"] = "valid_key";
    (prisma.api_keys.findFirst as jest.Mock).mockResolvedValue({
      id: "admin_key",
      accountId: "atom.near",
      scopes: ["full_access"], // Does not explicitly have write:vote
      keyHint: "hos_...",
    });

    const middleware = apiKeyAuth(["write:vote", "super_admin_action"]);
    await middleware(req as ApiKeyRequest, res as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user?.accountId).toBe("atom.near");
  });
});
