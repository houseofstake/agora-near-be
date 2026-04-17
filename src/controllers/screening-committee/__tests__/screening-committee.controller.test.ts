import request from "supertest";
import app from "../../../app";
import { prismaMock } from "../../../lib/tests/prismaMock";
import { Decimal } from "@prisma/client/runtime/client";

jest.mock("../../../lib/signature/verifySignature");

import { verifySignedPayload } from "../../../lib/signature/verifySignature";

const mockVerifySignedPayload = verifySignedPayload as jest.MockedFunction<
  typeof verifySignedPayload
>;

describe("ScreeningCommitteeController", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation();
    jest.clearAllMocks();
  });

  // ─── helpers ───────────────────────────────────────────────────────

  const makeMember = (overrides: Partial<any> = {}) => ({
    id: "member-1",
    wallet: "screening1.near",
    name: "Alice Chen",
    subtitle: "NF",
    role: "SCREENING",
    appointedAt: new Date("2024-06-01"),
    createdAt: new Date("2024-06-01"),
    updatedAt: new Date("2024-06-01"),
    ...overrides,
  });

  const makeGovernanceStatus = (overrides: Partial<any> = {}) => ({
    proposalId: "1",
    screeningStatus: "PENDING",
    screeningDeadline: new Date(Date.now() + 3 * 86_400_000),
    councilStatus: null,
    vetoDeadline: null,
    ratifiedAt: null,
    createdAt: new Date("2024-07-01"),
    updatedAt: new Date("2024-07-01"),
    ...overrides,
  });

  const makeProposal = (overrides: Partial<any> = {}) => ({
    id: "receipt-1",
    receiptId: "receipt-1",
    proposalId: new Decimal("1"),
    proposalTitle: "Test Proposal",
    proposalDescription: "Description",
    proposalUrl: "https://forum.near.org/t/test/1",
    hosContractAddress: "v.r-1748895584.testnet",
    isApproved: false,
    isRejected: false,
    hasVotes: false,
    createdAt: new Date("2024-07-01"),
    creatorId: "alice.near",
    approvedAt: null,
    votingStartAt: null,
    approverId: null,
    rejectedAt: null,
    rejecterId: null,
    votingDurationNs: null,
    totalVenearAtApproval: null,
    listaggDistinctVoters: null,
    numDistinctVoters: BigInt(0),
    numForVotes: BigInt(0),
    numAgainstVotes: BigInt(0),
    forVotingPower: new Decimal("0"),
    againstVotingPower: new Decimal("0"),
    abstainVotingPower: new Decimal("0"),
    blockHeight: BigInt(100001),
    blockHash: "hash-1",
    ...overrides,
  });

  // ─── GET /api/screening-committee/members ──────────────────────────

  describe("GET /api/screening-committee/members", () => {
    it("should return screening committee members", async () => {
      const members = [
        makeMember(),
        makeMember({
          id: "member-2",
          wallet: "screening2.near",
          name: "Bob K",
          subtitle: null,
        }),
      ];

      prismaMock.governance_members.findMany.mockResolvedValue(members);

      const res = await request(app)
        .get("/api/screening-committee/members")
        .expect(200)
        .expect("Content-Type", /json/);

      expect(res.body.members).toHaveLength(2);
      expect(res.body.members[0]).toEqual({
        id: "member-1",
        wallet: "screening1.near",
        name: "Alice Chen",
        subtitle: "NF",
        appointedAt: expect.any(String),
      });

      expect(prismaMock.governance_members.findMany).toHaveBeenCalledWith({
        where: { role: "SCREENING" },
        orderBy: { appointedAt: "desc" },
      });
    });

    it("should return empty array when no members", async () => {
      prismaMock.governance_members.findMany.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/screening-committee/members")
        .expect(200);

      expect(res.body.members).toEqual([]);
    });

    it("should handle database error gracefully", async () => {
      prismaMock.governance_members.findMany.mockRejectedValue(
        new Error("DB error"),
      );

      const res = await request(app)
        .get("/api/screening-committee/members")
        .expect(500);

      expect(res.body).toEqual({ error: "Failed to fetch members" });
    });
  });

  // ─── GET /api/screening-committee/proposals?status=current ─────────

  describe("GET /api/screening-committee/proposals?status=current", () => {
    it("should return current proposals with stats and pagination", async () => {
      const statuses = [makeGovernanceStatus()];
      const proposals = [makeProposal()];

      prismaMock.proposal_governance_status.count
        .mockResolvedValueOnce(1) // pendingCount
        .mockResolvedValueOnce(2); // approvedAllTimeCount
      prismaMock.proposal_governance_status.findMany
        .mockResolvedValueOnce([{ proposalId: "1" }]) // allGovernanceIds
        .mockResolvedValueOnce(statuses); // getCurrentProposals statuses
      prismaMock.draft_proposals.count.mockResolvedValue(0); // incomingCount
      prismaMock.proposals.findMany.mockResolvedValue(proposals);
      (prismaMock.governance_reviews.groupBy as any).mockResolvedValue([]);

      const res = await request(app)
        .get("/api/screening-committee/proposals")
        .query({ status: "current", page: "1", page_size: "10" })
        .expect(200);

      expect(res.body.stats).toEqual({
        pendingCount: 1,
        incomingCount: 0,
        approvedAllTimeCount: 2,
      });
      expect(res.body.proposals).toHaveLength(1);
      expect(res.body.proposals[0]).toMatchObject({
        proposalId: "1",
        title: "Test Proposal",
        submittedBy: "alice.near",
      });
      expect(res.body.page).toBe(1);
      expect(res.body.pageSize).toBe(10);
    });

    it("should return empty proposals when no pending statuses", async () => {
      prismaMock.proposal_governance_status.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      prismaMock.proposal_governance_status.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]); // empty pending statuses
      prismaMock.draft_proposals.count.mockResolvedValue(0);

      const res = await request(app)
        .get("/api/screening-committee/proposals")
        .query({ status: "current" })
        .expect(200);

      expect(res.body.proposals).toEqual([]);
      expect(res.body.count).toBe(0);
    });

    it("should handle database error gracefully", async () => {
      prismaMock.proposal_governance_status.count.mockRejectedValue(
        new Error("DB error"),
      );

      const res = await request(app)
        .get("/api/screening-committee/proposals")
        .query({ status: "current" })
        .expect(500);

      expect(res.body).toEqual({ error: "Failed to fetch proposals" });
    });
  });

  // ─── GET /api/screening-committee/proposals?status=incoming ────────

  describe("GET /api/screening-committee/proposals?status=incoming", () => {
    it("should return incoming draft proposals", async () => {
      const drafts = [
        {
          id: "draft-1",
          title: "Community validator program",
          description: "A draft",
          author: "community-dao.near",
          proposalUrl: "https://forum.near.org/t/test/2001",
          stage: "SUBMITTED",
          submittedAt: new Date("2024-07-10"),
          createdAt: new Date("2024-07-10"),
          updatedAt: new Date("2024-07-10"),
        },
      ];

      prismaMock.proposal_governance_status.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      prismaMock.proposal_governance_status.findMany.mockResolvedValue([]);
      prismaMock.draft_proposals.count
        .mockResolvedValueOnce(1) // stats incomingCount
        .mockResolvedValueOnce(1); // getIncomingProposals count
      prismaMock.draft_proposals.findMany.mockResolvedValue(drafts);

      const res = await request(app)
        .get("/api/screening-committee/proposals")
        .query({ status: "incoming" })
        .expect(200);

      expect(res.body.proposals).toHaveLength(1);
      expect(res.body.proposals[0]).toMatchObject({
        id: "draft-1",
        title: "Community validator program",
        submittedBy: "community-dao.near",
      });
    });
  });

  // ─── GET /api/screening-committee/proposals?status=past ────────────

  describe("GET /api/screening-committee/proposals?status=past", () => {
    it("should return past proposals", async () => {
      const statuses = [
        makeGovernanceStatus({
          proposalId: "4",
          screeningStatus: "APPROVED",
          screeningDeadline: new Date("2024-06-20"),
          updatedAt: new Date("2024-06-25"),
        }),
      ];
      const proposals = [makeProposal({ proposalId: new Decimal("4") })];

      prismaMock.proposal_governance_status.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(1);
      prismaMock.proposal_governance_status.findMany
        .mockResolvedValueOnce([{ proposalId: "4" }])
        .mockResolvedValueOnce(statuses);
      prismaMock.draft_proposals.count.mockResolvedValue(0);
      prismaMock.proposals.findMany.mockResolvedValue(proposals);
      (prismaMock.governance_reviews.groupBy as any).mockResolvedValue([]);

      const res = await request(app)
        .get("/api/screening-committee/proposals")
        .query({ status: "past" })
        .expect(200);

      expect(res.body.proposals).toHaveLength(1);
      expect(res.body.proposals[0]).toMatchObject({
        proposalId: "4",
        status: "APPROVED",
      });
    });

    it("should return empty when no past proposals", async () => {
      prismaMock.proposal_governance_status.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      prismaMock.proposal_governance_status.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      prismaMock.draft_proposals.count.mockResolvedValue(0);

      const res = await request(app)
        .get("/api/screening-committee/proposals")
        .query({ status: "past" })
        .expect(200);

      expect(res.body.proposals).toEqual([]);
    });
  });

  // ─── GET /api/screening-committee/proposals (invalid status) ───────

  describe("GET /api/screening-committee/proposals?status=invalid", () => {
    it("should return 400 for invalid status", async () => {
      prismaMock.proposal_governance_status.count.mockResolvedValue(0);
      prismaMock.proposal_governance_status.findMany.mockResolvedValue([]);
      prismaMock.draft_proposals.count.mockResolvedValue(0);

      const res = await request(app)
        .get("/api/screening-committee/proposals")
        .query({ status: "invalid" })
        .expect(400);

      expect(res.body).toEqual({
        error: "Invalid status. Use current, incoming, or past.",
      });
    });
  });

  // ─── GET /api/screening-committee/proposals/:proposalId ────────────

  describe("GET /api/screening-committee/proposals/:proposalId", () => {
    it("should return proposal details with reviews and members", async () => {
      const proposal = makeProposal();
      const govStatus = makeGovernanceStatus();
      const member = makeMember();
      const reviews = [
        {
          id: "review-1",
          proposalId: "1",
          memberId: "member-1",
          action: "APPROVE",
          rationale: "Looks good",
          createdAt: new Date("2024-07-02"),
          member,
        },
      ];

      prismaMock.proposals.findFirst.mockResolvedValue(proposal);
      prismaMock.proposal_governance_status.findUnique.mockResolvedValue(
        govStatus,
      );
      prismaMock.governance_reviews.findMany.mockResolvedValue(reviews);
      prismaMock.governance_members.findMany.mockResolvedValue([member]);

      const res = await request(app)
        .get("/api/screening-committee/proposals/1")
        .expect(200);

      expect(res.body.proposal).toMatchObject({
        proposalId: "1",
        title: "Test Proposal",
        submittedBy: "alice.near",
      });
      expect(res.body.governanceStatus).toMatchObject({
        proposalId: "1",
        screeningStatus: "PENDING",
      });
      expect(res.body.reviews).toHaveLength(1);
      expect(res.body.reviews[0]).toMatchObject({
        id: "review-1",
        action: "APPROVE",
        rationale: "Looks good",
      });
      expect(res.body.members).toHaveLength(1);
    });

    it("should return 404 when proposal not found", async () => {
      prismaMock.proposals.findFirst.mockResolvedValue(null);
      prismaMock.proposal_governance_status.findUnique.mockResolvedValue(null);
      prismaMock.governance_reviews.findMany.mockResolvedValue([]);
      prismaMock.governance_members.findMany.mockResolvedValue([]);

      const res = await request(app)
        .get("/api/screening-committee/proposals/999")
        .expect(404);

      expect(res.body).toEqual({ error: "Proposal not found" });
    });

    it("should handle database error gracefully", async () => {
      prismaMock.proposals.findFirst.mockRejectedValue(new Error("DB error"));

      const res = await request(app)
        .get("/api/screening-committee/proposals/1")
        .expect(500);

      expect(res.body).toEqual({ error: "Failed to fetch proposal" });
    });
  });

  // ─── POST /api/screening-committee/proposals/:proposalId/review ────

  describe("POST /api/screening-committee/proposals/:proposalId/review", () => {
    const validBody = {
      accountId: "screening1.near",
      signature: "test_sig",
      publicKey: "ed25519:testkey",
      message: "review proposal",
      data: { action: "APPROVE", rationale: "Well structured" },
    };

    it("should submit a review successfully", async () => {
      const member = makeMember();
      const govStatus = makeGovernanceStatus();
      const createdReview = {
        id: "review-new",
        proposalId: "1",
        memberId: "member-1",
        action: "APPROVE",
        rationale: "Well structured",
        createdAt: new Date(),
      };

      prismaMock.proposal_governance_status.findUnique.mockResolvedValue(
        govStatus,
      );
      mockVerifySignedPayload.mockResolvedValue(true);
      prismaMock.governance_members.findFirst.mockResolvedValue(member);
      prismaMock.governance_reviews.findFirst.mockResolvedValue(null);
      prismaMock.governance_reviews.create.mockResolvedValue(createdReview);

      const res = await request(app)
        .post("/api/screening-committee/proposals/1/review")
        .send(validBody)
        .expect(201);

      expect(res.body.review).toMatchObject({
        id: "review-new",
        action: "APPROVE",
      });
      expect(mockVerifySignedPayload).toHaveBeenCalledWith({
        signedPayload: {
          signature: "test_sig",
          publicKey: "ed25519:testkey",
          message: "review proposal",
          data: { action: "APPROVE", rationale: "Well structured", proposalId: "1" },
        },
        networkId: "mainnet",
        accountId: "screening1.near",
      });
    });

    it("should allow COMMENT action", async () => {
      const member = makeMember();
      const govStatus = makeGovernanceStatus();
      const createdReview = {
        id: "review-comment",
        proposalId: "1",
        memberId: "member-1",
        action: "COMMENT",
        rationale: "Can you clarify?",
        createdAt: new Date(),
      };

      prismaMock.proposal_governance_status.findUnique.mockResolvedValue(
        govStatus,
      );
      mockVerifySignedPayload.mockResolvedValue(true);
      prismaMock.governance_members.findFirst.mockResolvedValue(member);
      prismaMock.governance_reviews.create.mockResolvedValue(createdReview);

      const res = await request(app)
        .post("/api/screening-committee/proposals/1/review")
        .send({
          ...validBody,
          data: { action: "COMMENT", rationale: "Can you clarify?" },
        })
        .expect(201);

      expect(res.body.review.action).toBe("COMMENT");
    });

    it("should reject missing required fields", async () => {
      const res = await request(app)
        .post("/api/screening-committee/proposals/1/review")
        .send({ accountId: "screening1.near" })
        .expect(400);

      expect(res.body.error).toContain("required");
    });

    it("should reject invalid action", async () => {
      const res = await request(app)
        .post("/api/screening-committee/proposals/1/review")
        .send({ ...validBody, data: { action: "VETO" } })
        .expect(400);

      expect(res.body.error).toContain("Invalid action");
    });

    it("should reject if proposal is not pending", async () => {
      prismaMock.proposal_governance_status.findUnique.mockResolvedValue(
        makeGovernanceStatus({ screeningStatus: "APPROVED" }),
      );

      const res = await request(app)
        .post("/api/screening-committee/proposals/1/review")
        .send(validBody)
        .expect(400);

      expect(res.body).toEqual({
        error: "Proposal is not pending screening review",
      });
    });

    it("should reject if proposal governance status not found", async () => {
      prismaMock.proposal_governance_status.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/screening-committee/proposals/1/review")
        .send(validBody)
        .expect(400);

      expect(res.body).toEqual({
        error: "Proposal is not pending screening review",
      });
    });

    it("should reject invalid signature", async () => {
      prismaMock.proposal_governance_status.findUnique.mockResolvedValue(
        makeGovernanceStatus(),
      );
      mockVerifySignedPayload.mockResolvedValue(false);

      const res = await request(app)
        .post("/api/screening-committee/proposals/1/review")
        .send(validBody)
        .expect(401);

      expect(res.body).toEqual({ error: "Invalid signature" });
    });

    it("should reject non-screening-committee member", async () => {
      prismaMock.proposal_governance_status.findUnique.mockResolvedValue(
        makeGovernanceStatus(),
      );
      mockVerifySignedPayload.mockResolvedValue(true);
      prismaMock.governance_members.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/screening-committee/proposals/1/review")
        .send(validBody)
        .expect(403);

      expect(res.body).toEqual({ error: "Not a screening committee member" });
    });

    it("should reject duplicate vote (application-level check)", async () => {
      const member = makeMember();
      const existingVote = {
        id: "review-old",
        proposalId: "1",
        memberId: "member-1",
        action: "APPROVE",
        rationale: null,
        createdAt: new Date(),
      };

      prismaMock.proposal_governance_status.findUnique.mockResolvedValue(
        makeGovernanceStatus(),
      );
      mockVerifySignedPayload.mockResolvedValue(true);
      prismaMock.governance_members.findFirst.mockResolvedValue(member);
      prismaMock.governance_reviews.findFirst.mockResolvedValue(existingVote);

      const res = await request(app)
        .post("/api/screening-committee/proposals/1/review")
        .send(validBody)
        .expect(409);

      expect(res.body).toEqual({ error: "Already voted on this proposal" });
    });

    it("should handle P2002 unique constraint violation", async () => {
      const member = makeMember();

      prismaMock.proposal_governance_status.findUnique.mockResolvedValue(
        makeGovernanceStatus(),
      );
      mockVerifySignedPayload.mockResolvedValue(true);
      prismaMock.governance_members.findFirst.mockResolvedValue(member);
      prismaMock.governance_reviews.findFirst.mockResolvedValue(null);

      const prismaError = new Error("Unique constraint failed");
      (prismaError as any).code = "P2002";
      prismaMock.governance_reviews.create.mockRejectedValue(prismaError);

      const res = await request(app)
        .post("/api/screening-committee/proposals/1/review")
        .send(validBody)
        .expect(409);

      expect(res.body).toEqual({ error: "Already voted on this proposal" });
    });

    it("should handle database error gracefully", async () => {
      prismaMock.proposal_governance_status.findUnique.mockRejectedValue(
        new Error("DB error"),
      );

      const res = await request(app)
        .post("/api/screening-committee/proposals/1/review")
        .send(validBody)
        .expect(500);

      expect(res.body).toEqual({ error: "Failed to submit review" });
    });
  });
});
