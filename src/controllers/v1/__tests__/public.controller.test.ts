import { Response } from "express";
import { getAgentProfile, getForumData, castProxyVote } from "../public.controller";
import { ApiKeyRequest } from "../../../middleware/apiKeyAuth";
import { prisma } from "../../../index";

jest.mock("../../../index", () => ({
  prisma: {
    delegate_statements: {
      findUnique: jest.fn(),
    },
  },
}));

describe("V1 Public Controller", () => {
  let req: Partial<ApiKeyRequest>;
  let res: Partial<Response>;

  beforeEach(() => {
    req = {
      user: {
        accountId: "atom.near",
        keyId: "key_1",
        scopes: ["full_access"],
      },
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
  });

  describe("getAgentProfile", () => {
    it("should return 401 if accountId is not set", async () => {
      req.user!.accountId = "";
      await getAgentProfile(req as ApiKeyRequest, res as Response);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should return the profile data from db", async () => {
      const mockProfile = { address: "atom.near", twitter: "@test" };
      (prisma.delegate_statements.findUnique as jest.Mock).mockResolvedValue(mockProfile);

      await getAgentProfile(req as ApiKeyRequest, res as Response);

      expect(prisma.delegate_statements.findUnique).toHaveBeenCalledWith({
        where: { address: "atom.near" },
        select: expect.any(Object),
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ profile: mockProfile })
      );
    });
  });

  describe("getForumData", () => {
    it("should return mock forum data", async () => {
      await getForumData(req as ApiKeyRequest, res as Response);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Fetching forum activity for atom.near",
          forumData: expect.any(Array)
        })
      );
    });
  });

  describe("castProxyVote", () => {
    it("should return 400 if proposalId or voteAction are missing", async () => {
      await castProxyVote(req as ApiKeyRequest, res as Response);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: "Missing proposalId or voteAction" })
      );
    });

    it("should return 201 when valid proposal and action provided", async () => {
      req.body = { proposalId: 10, voteAction: "Approve" };
      await castProxyVote(req as ApiKeyRequest, res as Response);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ receipt: expect.objectContaining({ proposalId: 10, action: "Approve" }) })
      );
    });
  });
});
