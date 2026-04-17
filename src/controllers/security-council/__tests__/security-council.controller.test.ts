import request from "supertest";
import app from "../../../app";
import { prismaMock } from "../../../lib/tests/prismaMock";
import { Decimal } from "@prisma/client/runtime/client";

jest.mock("../../../lib/signature/verifySignature");

import { verifySignedPayload } from "../../../lib/signature/verifySignature";

const mockVerifySignedPayload = verifySignedPayload as jest.MockedFunction<
  typeof verifySignedPayload
>;

describe("SecurityCouncilController", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation();
    jest.clearAllMocks();
  });

  // ─── helpers ───────────────────────────────────────────────────────

  const makeMember = (overrides: Partial<any> = {}) => ({
    id: "council-1",
    wallet: "council1.near",
    name: "David Park",
    subtitle: "Security WG",
    role: "COUNCIL",
    appointedAt: new Date("2024-05-01"),
    createdAt: new Date("2024-05-01"),
    updatedAt: new Date("2024-05-01"),
    ...overrides,
  });

  const makeGovernanceStatus = (overrides: Partial<any> = {}) => ({
    proposalId: "3",
    screeningStatus: "APPROVED",
    screeningDeadline: new Date("2024-06-20"),
    councilStatus: "ACTIVE",
    vetoDeadline: new Date(Date.now() + 2 * 86_400_000),
    ratifiedAt: null,
    createdAt: new Date("2024-07-01"),
    updatedAt: new Date("2024-07-01"),
    ...overrides,
  });

  const makeProposal = (overrides: Partial<any> = {}) => ({
    id: "receipt-3",
    receiptId: "receipt-3",
    proposalId: new Decimal("3"),
    proposalTitle: "Bridge Security Audit",
    proposalDescription: "Audit the Rainbow Bridge",
    proposalUrl: "https://forum.near.org/t/bridge/1003",
    hosContractAddress: "v.r-1748895584.testnet",
    isApproved: true,
    isRejected: false,
    hasVotes: true,
    createdAt: new Date("2024-07-01"),
    creatorId: "carol.near",
    approvedAt: new Date("2024-07-05"),
    votingStartAt: null,
    approverId: null,
    rejectedAt: null,
    rejecterId: null,
    votingDurationNs: null,
    totalVenearAtApproval: null,
    listaggDistinctVoters: null,
    numDistinctVoters: BigInt(5),
    numForVotes: BigInt(4),
    numAgainstVotes: BigInt(1),
    forVotingPower: new Decimal("1000000"),
    againstVotingPower: new Decimal("200000"),
    abstainVotingPower: new Decimal("0"),
    blockHeight: BigInt(100003),
    blockHash: "hash-3",
    ...overrides,
  });

  // ─── GET /api/security-council/members ─────────────────────────────

  describe("GET /api/security-council/members", () => {
    it("should return security council members", async () => {
      const members = [
        makeMember(),
        makeMember({
          id: "council-2",
          wallet: "council2.near",
          name: "Eva Lindström",
          subtitle: "NF",
        }),
      ];

      prismaMock.governance_members.findMany.mockResolvedValue(members);

      const res = await request(app)
        .get("/api/security-council/members")
        .expect(200)
        .expect("Content-Type", /json/);

      expect(res.body.members).toHaveLength(2);
      expect(res.body.members[0]).toEqual({
        id: "council-1",
        wallet: "council1.near",
        name: "David Park",
        subtitle: "Security WG",
        appointedAt: expect.any(String),
      });

      expect(prismaMock.governance_members.findMany).toHaveBeenCalledWith({
        where: { role: "COUNCIL" },
        orderBy: { appointedAt: "desc" },
      });
    });

    it("should return empty array when no members", async () => {
      prismaMock.governance_members.findMany.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/security-council/members")
        .expect(200);

      expect(res.body.members).toEqual([]);
    });

    it("should handle database error gracefully", async () => {
      prismaMock.governance_members.findMany.mockRejectedValue(
        new Error("DB error"),
      );

      const res = await request(app)
        .get("/api/security-council/members")
        .expect(500);

      expect(res.body).toEqual({ error: "Failed to fetch members" });
    });
  });

  // ─── GET /api/security-council/proposals?status=active ─────────────

  describe("GET /api/security-council/proposals?status=active", () => {
    it("should return active proposals with stats", async () => {
      const statuses = [makeGovernanceStatus()];
      const proposals = [makeProposal()];

      prismaMock.proposal_governance_status.count
        .mockResolvedValueOnce(1) // activeCount
        .mockResolvedValueOnce(3) // ratifiedAllTimeCount
        .mockResolvedValueOnce(1); // vetoedCount
      prismaMock.proposal_governance_status.findMany.mockResolvedValue(
        statuses,
      );
      prismaMock.proposals.findMany.mockResolvedValue(proposals);

      const res = await request(app)
        .get("/api/security-council/proposals")
        .query({ status: "active", page: "1", page_size: "10" })
        .expect(200);

      expect(res.body.stats).toEqual({
        activeCount: 1,
        ratifiedAllTimeCount: 3,
        vetoedCount: 1,
      });
      expect(res.body.proposals).toHaveLength(1);
      expect(res.body.proposals[0]).toMatchObject({
        proposalId: "3",
        title: "Bridge Security Audit",
        submittedBy: "carol.near",
        actionStatus: "No Veto Issued",
      });
    });

    it("should return empty when no active proposals", async () => {
      prismaMock.proposal_governance_status.count.mockResolvedValue(0);
      prismaMock.proposal_governance_status.findMany.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/security-council/proposals")
        .query({ status: "active" })
        .expect(200);

      expect(res.body.proposals).toEqual([]);
      expect(res.body.count).toBe(0);
    });

    it("should include wallet action status when wallet is provided", async () => {
      const statuses = [makeGovernanceStatus()];
      const proposals = [makeProposal()];
      const member = makeMember();

      prismaMock.proposal_governance_status.count.mockResolvedValue(1);
      prismaMock.proposal_governance_status.findMany.mockResolvedValue(
        statuses,
      );
      prismaMock.proposals.findMany.mockResolvedValue(proposals);
      prismaMock.governance_members.findFirst.mockResolvedValue(member);
      prismaMock.governance_reviews.findMany.mockResolvedValue([
        {
          id: "rev-1",
          proposalId: "3",
          memberId: "council-1",
          action: "VETO",
          rationale: "Security risk",
          createdAt: new Date(),
        },
      ]);

      const res = await request(app)
        .get("/api/security-council/proposals")
        .query({ status: "active", wallet: "council1.near" })
        .expect(200);

      expect(res.body.proposals[0].actionStatus).toBe("VETO");
    });

    it("should handle database error gracefully", async () => {
      prismaMock.proposal_governance_status.count.mockRejectedValue(
        new Error("DB error"),
      );

      const res = await request(app)
        .get("/api/security-council/proposals")
        .query({ status: "active" })
        .expect(500);

      expect(res.body).toEqual({ error: "Failed to fetch proposals" });
    });
  });

  // ─── GET /api/security-council/proposals?status=passed ─────────────

  describe("GET /api/security-council/proposals?status=passed", () => {
    it("should return ratified proposals", async () => {
      const statuses = [
        makeGovernanceStatus({
          proposalId: "4",
          councilStatus: "RATIFIED",
          ratifiedAt: new Date("2024-07-10"),
        }),
      ];
      const proposals = [
        makeProposal({ proposalId: new Decimal("4"), proposalTitle: "Sharding v2" }),
      ];

      prismaMock.proposal_governance_status.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0);
      prismaMock.proposal_governance_status.findMany.mockResolvedValue(
        statuses,
      );
      prismaMock.proposals.findMany.mockResolvedValue(proposals);

      const res = await request(app)
        .get("/api/security-council/proposals")
        .query({ status: "passed" })
        .expect(200);

      expect(res.body.proposals).toHaveLength(1);
      expect(res.body.proposals[0]).toMatchObject({
        proposalId: "4",
        title: "Sharding v2",
      });
      expect(res.body.proposals[0].ratifiedOn).toBeTruthy();
    });

    it("should return empty when no passed proposals", async () => {
      prismaMock.proposal_governance_status.count.mockResolvedValue(0);
      prismaMock.proposal_governance_status.findMany.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/security-council/proposals")
        .query({ status: "passed" })
        .expect(200);

      expect(res.body.proposals).toEqual([]);
    });
  });

  // ─── GET /api/security-council/proposals?status=vetoed ─────────────

  describe("GET /api/security-council/proposals?status=vetoed", () => {
    it("should return vetoed proposals with veto author info", async () => {
      const statuses = [
        makeGovernanceStatus({
          proposalId: "5",
          councilStatus: "VETOED",
          updatedAt: new Date("2024-07-12"),
        }),
      ];
      const proposals = [
        makeProposal({
          proposalId: new Decimal("5"),
          proposalTitle: "Staking redistribution",
        }),
      ];
      const vetoReviews = [
        {
          id: "veto-1",
          proposalId: "5",
          memberId: "council-1",
          action: "VETO",
          rationale: "Security risk",
          createdAt: new Date("2024-07-12"),
          member: makeMember(),
        },
      ];

      prismaMock.proposal_governance_status.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(1);
      prismaMock.proposal_governance_status.findMany.mockResolvedValue(
        statuses,
      );
      prismaMock.proposals.findMany.mockResolvedValue(proposals);
      prismaMock.governance_reviews.findMany.mockResolvedValue(vetoReviews);

      const res = await request(app)
        .get("/api/security-council/proposals")
        .query({ status: "vetoed" })
        .expect(200);

      expect(res.body.proposals).toHaveLength(1);
      expect(res.body.proposals[0]).toMatchObject({
        proposalId: "5",
        title: "Staking redistribution",
        rationaleAuthor: { name: "David Park", wallet: "council1.near" },
      });
    });
  });

  // ─── GET /api/security-council/proposals (invalid status) ──────────

  describe("GET /api/security-council/proposals?status=invalid", () => {
    it("should return 400 for invalid status", async () => {
      prismaMock.proposal_governance_status.count.mockResolvedValue(0);

      const res = await request(app)
        .get("/api/security-council/proposals")
        .query({ status: "invalid" })
        .expect(400);

      expect(res.body).toEqual({
        error: "Invalid status. Use active, passed, or vetoed.",
      });
    });
  });

  // ─── GET /api/security-council/proposals/:proposalId ───────────────

  describe("GET /api/security-council/proposals/:proposalId", () => {
    it("should return proposal details with governance status", async () => {
      const proposal = makeProposal();
      const govStatus = makeGovernanceStatus();

      prismaMock.proposals.findFirst.mockResolvedValue(proposal);
      prismaMock.proposal_governance_status.findUnique.mockResolvedValue(
        govStatus,
      );
      prismaMock.governance_reviews.findMany.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/security-council/proposals/3")
        .expect(200);

      expect(res.body.proposal).toMatchObject({
        proposalId: "3",
        title: "Bridge Security Audit",
        submittedBy: "carol.near",
        votesSummary: expect.any(String),
      });
      expect(res.body.governanceStatus).toMatchObject({
        proposalId: "3",
        councilStatus: "ACTIVE",
      });
      expect(res.body.vetoRationale).toBeNull();
    });

    it("should include veto rationale when proposal was vetoed", async () => {
      const proposal = makeProposal();
      const govStatus = makeGovernanceStatus({ councilStatus: "VETOED" });
      const member = makeMember();
      const vetoReview = {
        id: "veto-1",
        proposalId: "3",
        memberId: "council-1",
        action: "VETO",
        rationale: "Security risk identified",
        createdAt: new Date("2024-07-12"),
        member,
      };

      prismaMock.proposals.findFirst.mockResolvedValue(proposal);
      prismaMock.proposal_governance_status.findUnique.mockResolvedValue(
        govStatus,
      );
      prismaMock.governance_reviews.findMany.mockResolvedValue([vetoReview]);

      const res = await request(app)
        .get("/api/security-council/proposals/3")
        .expect(200);

      expect(res.body.vetoRationale).toMatchObject({
        rationale: "Security risk identified",
        member: { wallet: "council1.near", name: "David Park" },
      });
    });

    it("should return 404 when proposal not found", async () => {
      prismaMock.proposals.findFirst.mockResolvedValue(null);
      prismaMock.proposal_governance_status.findUnique.mockResolvedValue(null);
      prismaMock.governance_reviews.findMany.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/security-council/proposals/999")
        .expect(404);

      expect(res.body).toEqual({ error: "Proposal not found" });
    });

    it("should handle database error gracefully", async () => {
      prismaMock.proposals.findFirst.mockRejectedValue(new Error("DB error"));

      const res = await request(app)
        .get("/api/security-council/proposals/3")
        .expect(500);

      expect(res.body).toEqual({ error: "Failed to fetch proposal" });
    });
  });

  // ─── POST /api/security-council/proposals/:proposalId/veto ─────────

  describe("POST /api/security-council/proposals/:proposalId/veto", () => {
    const validBody = {
      accountId: "council1.near",
      signature: "test_sig",
      publicKey: "ed25519:councilkey",
      message: "veto proposal",
      data: { rationale: "Severe security risk in the bridge logic" },
    };

    it("should submit a veto successfully", async () => {
      const member = makeMember();
      const govStatus = makeGovernanceStatus();
      const createdReview = {
        id: "veto-new",
        proposalId: "3",
        memberId: "council-1",
        action: "VETO",
        rationale: "Severe security risk in the bridge logic",
        createdAt: new Date(),
      };
      const updatedStatus = {
        ...govStatus,
        councilStatus: "VETOED",
      };

      prismaMock.proposal_governance_status.findUnique.mockResolvedValue(
        govStatus,
      );
      mockVerifySignedPayload.mockResolvedValue(true);
      prismaMock.governance_members.findFirst.mockResolvedValue(member);
      (prismaMock.$transaction as any).mockResolvedValue([
        createdReview,
        updatedStatus,
      ]);

      const res = await request(app)
        .post("/api/security-council/proposals/3/veto")
        .send(validBody)
        .expect(201);

      expect(res.body.review).toMatchObject({
        id: "veto-new",
        action: "VETO",
      });
      expect(res.body.governanceStatus).toMatchObject({
        councilStatus: "VETOED",
      });
      expect(mockVerifySignedPayload).toHaveBeenCalledWith({
        signedPayload: {
          signature: "test_sig",
          publicKey: "ed25519:councilkey",
          message: "veto proposal",
          data: {
            rationale: "Severe security risk in the bridge logic",
            proposalId: "3",
          },
        },
        networkId: "mainnet",
        accountId: "council1.near",
      });
    });

    it("should reject missing required fields", async () => {
      const res = await request(app)
        .post("/api/security-council/proposals/3/veto")
        .send({ accountId: "council1.near" })
        .expect(400);

      expect(res.body.error).toContain("required");
    });

    it("should reject missing rationale", async () => {
      const res = await request(app)
        .post("/api/security-council/proposals/3/veto")
        .send({ ...validBody, data: {} })
        .expect(400);

      expect(res.body).toEqual({ error: "Rationale is required for a veto" });
    });

    it("should reject if proposal is not in active veto window", async () => {
      prismaMock.proposal_governance_status.findUnique.mockResolvedValue(
        makeGovernanceStatus({ councilStatus: "RATIFIED" }),
      );

      const res = await request(app)
        .post("/api/security-council/proposals/3/veto")
        .send(validBody)
        .expect(400);

      expect(res.body).toEqual({
        error: "Proposal is not in active veto window",
      });
    });

    it("should reject if governance status not found", async () => {
      prismaMock.proposal_governance_status.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/security-council/proposals/3/veto")
        .send(validBody)
        .expect(400);

      expect(res.body).toEqual({
        error: "Proposal is not in active veto window",
      });
    });

    it("should reject if veto deadline has passed", async () => {
      prismaMock.proposal_governance_status.findUnique.mockResolvedValue(
        makeGovernanceStatus({
          vetoDeadline: new Date(Date.now() - 86_400_000),
        }),
      );

      const res = await request(app)
        .post("/api/security-council/proposals/3/veto")
        .send(validBody)
        .expect(400);

      expect(res.body).toEqual({ error: "Veto deadline has passed" });
    });

    it("should reject invalid signature", async () => {
      prismaMock.proposal_governance_status.findUnique.mockResolvedValue(
        makeGovernanceStatus(),
      );
      mockVerifySignedPayload.mockResolvedValue(false);

      const res = await request(app)
        .post("/api/security-council/proposals/3/veto")
        .send(validBody)
        .expect(401);

      expect(res.body).toEqual({ error: "Invalid signature" });
    });

    it("should reject non-council member", async () => {
      prismaMock.proposal_governance_status.findUnique.mockResolvedValue(
        makeGovernanceStatus(),
      );
      mockVerifySignedPayload.mockResolvedValue(true);
      prismaMock.governance_members.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/security-council/proposals/3/veto")
        .send(validBody)
        .expect(403);

      expect(res.body).toEqual({ error: "Not a security council member" });
    });

    it("should handle database error gracefully", async () => {
      prismaMock.proposal_governance_status.findUnique.mockRejectedValue(
        new Error("DB error"),
      );

      const res = await request(app)
        .post("/api/security-council/proposals/3/veto")
        .send(validBody)
        .expect(500);

      expect(res.body).toEqual({ error: "Failed to submit veto" });
    });

    it("should handle transaction error gracefully", async () => {
      prismaMock.proposal_governance_status.findUnique.mockResolvedValue(
        makeGovernanceStatus(),
      );
      mockVerifySignedPayload.mockResolvedValue(true);
      prismaMock.governance_members.findFirst.mockResolvedValue(makeMember());
      (prismaMock.$transaction as any).mockRejectedValue(
        new Error("Transaction failed"),
      );

      const res = await request(app)
        .post("/api/security-council/proposals/3/veto")
        .send(validBody)
        .expect(500);

      expect(res.body).toEqual({ error: "Failed to submit veto" });
    });
  });
});
