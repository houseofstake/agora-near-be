import { Response } from "express";
import { getAgentProfile, getProposals, getDelegates, castProxyVote, getAPY, getVeNearSupply } from "../public.controller";
import { ApiKeyRequest } from "../../../middleware/apiKeyAuth";
import { prisma } from "../../../index";
import { ProposalController } from "../../proposal/proposals.controller";
import { DelegatesController } from "../../delegates/delegates.controller";
import { StakingController } from "../../staking/staking.controller";
import { VenearController } from "../../venear/venear.controller";

jest.mock("../../../index", () => ({
  prisma: {
    delegate_statements: {
      findUnique: jest.fn(),
    },
  },
}));



jest.mock("../../proposal/proposals.controller", () => ({ ProposalController: jest.fn().mockImplementation(() => ({ getApprovedProposals: jest.fn() })) }));
jest.mock("../../delegates/delegates.controller", () => ({ DelegatesController: jest.fn().mockImplementation(() => ({ getAllDelegates: jest.fn() })) }));
jest.mock("../../staking/staking.controller", () => ({ StakingController: jest.fn().mockImplementation(() => ({ getAPY: jest.fn() })) }));
jest.mock("../../venear/venear.controller", () => ({ VenearController: jest.fn().mockImplementation(() => ({ getTotalSupplyHistory: jest.fn() })) }));

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

  describe("getProposals", () => {
    it("should successfully call the endpoints without crashing", async () => {
      // Simulate successful run of the read methods
      await getProposals(req as ApiKeyRequest, res as Response);
    });
  });

  describe("getDelegates", () => {
    it("should successfully call the endpoints without crashing", async () => {
      await getDelegates(req as ApiKeyRequest, res as Response);
    });
  });

  describe("castProxyVote", () => {
    it("should return 400 if proposalId or voteAction are missing", async () => {
      req.body = {};

      await castProxyVote(req as ApiKeyRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Missing proposalId or voteAction",
      });
    });

    it("should return 201 when valid proposal and action provided", async () => {
      req.body = { proposalId: 123, voteAction: "Approve" };
      req.user = { accountId: "atom.near", keyId: "key_1", scopes: ["write:vote"] };

      await castProxyVote(req as ApiKeyRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Vote intent securely received on behalf of atom.near",
          receipt: expect.objectContaining({
            proposalId: 123,
            action: "Approve",
            status: "pending_on_chain",
          }),
        })
      );
    });
  });

  describe("getAPY", () => {
    it("should successfully call the endpoints without crashing", async () => {
      await getAPY(req as any, res as Response);
    });
  });

  describe("getVeNearSupply", () => {
    it("should successfully call the endpoints without crashing", async () => {
      await getVeNearSupply(req as ApiKeyRequest, res as Response);
    });
  });
});
