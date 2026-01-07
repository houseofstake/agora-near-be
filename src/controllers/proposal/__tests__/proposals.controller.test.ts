import request from "supertest";
import app from "../../../app";
import { prismaMock } from "../../../lib/tests/prismaMock";
import { Decimal } from "@prisma/client/runtime/client";

describe("ProposalController", () => {
  const mockProposals = [
    {
      id: 1,
      isApproved: true,
      isRejected: false,
      createdAt: new Date("2024-01-01"),
      forVotingPower: new Decimal("1"),
      againstVotingPower: new Decimal("2"),
      abstainVotingPower: new Decimal("3"),
      votingDurationNs: new Decimal("864000000000000000"), // 1 day
      votingStartAt: new Date("2024-01-02"),
    },
    {
      id: 2,
      isApproved: true,
      isRejected: false,
      createdAt: new Date("2024-01-01"),
      forVotingPower: new Decimal("1"),
      againstVotingPower: new Decimal("2"),
      abstainVotingPower: new Decimal("3"),
      votingDurationNs: new Decimal("864000000000000000"), // 1 day
      votingStartAt: new Date("2024-01-02"),
    },
  ];

  const mockProposalsResponse = [
    {
      id: 1,
      isApproved: true,
      isRejected: false,
      createdAt: "2024-01-01T00:00:00.000Z",
      forVotingPower: "1",
      againstVotingPower: "2",
      abstainVotingPower: "3",
      approvalThreshold: "5000",
      status: "Voting",
      votingDurationNs: "864000000000000000",
      votingStartTimeNs: "1704153600000000000",
      votingCreatedAtNs: "1704067200000000000",
      quorumAmount: "10000000000000000000000000", // QUORUM_FLOOR_YOCTONEAR (Dev/Test default)
      proposalType: "SimpleMajority",
    },
    {
      id: 2,
      isApproved: true,
      isRejected: false,
      createdAt: "2024-01-01T00:00:00.000Z",
      forVotingPower: "1",
      againstVotingPower: "2",
      abstainVotingPower: "3",
      approvalThreshold: "5000",  
      status: "Voting",
      votingDurationNs: "864000000000000000",
      votingStartTimeNs: "1704153600000000000",
      votingCreatedAtNs: "1704067200000000000",
      quorumAmount: "10000000000000000000000000", // QUORUM_FLOOR_YOCTONEAR (Dev/Test default)
      proposalType: "SimpleMajority",
    },
  ];

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date("2024-01-02"));
  });

  describe("GET /api/proposal/approved", () => {
    it("should return approved proposals with default pagination", async () => {
      // Arrange
      const mockCount = 50;

      prismaMock.proposals.findMany.mockResolvedValue(mockProposals);
      prismaMock.proposals.count.mockResolvedValue(mockCount);
      prismaMock.quorum_overrides.findMany.mockResolvedValue([]);

      // Act & Assert
      const response = await request(app)
        .get("/api/proposal/approved")
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        proposals: mockProposalsResponse,
        count: mockCount,
      });

      expect(prismaMock.proposals.findMany).toHaveBeenCalledWith({
        where: { isApproved: true, isRejected: false },
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 10,
      });

      expect(prismaMock.proposals.count).toHaveBeenCalledWith({
        where: { isApproved: true, isRejected: false },
      });
    });

    it("should return approved proposals with custom pagination", async () => {
      const mockCount = 25;

      prismaMock.proposals.findMany.mockResolvedValue(mockProposals);
      prismaMock.proposals.count.mockResolvedValue(mockCount);
      prismaMock.quorum_overrides.findMany.mockResolvedValue([]);

      // Act & Assert
      const response = await request(app)
        .get("/api/proposal/approved")
        .query({ page_size: "5", page: "3" })
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        proposals: mockProposalsResponse,
        count: mockCount,
      });

      expect(prismaMock.proposals.findMany).toHaveBeenCalledWith({
        where: { isApproved: true, isRejected: false },
        orderBy: { createdAt: "desc" },
        skip: 10,
        take: 5,
      });

      expect(prismaMock.proposals.count).toHaveBeenCalledWith({
        where: { isApproved: true, isRejected: false },
      });
    });

    it("should handle database error gracefully", async () => {
      // Arrange
      const errorMessage = "Database connection failed";
      prismaMock.proposals.findMany.mockRejectedValue(new Error(errorMessage));

      // Act & Assert
      const response = await request(app)
        .get("/api/proposal/approved")
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Failed to fetch approved proposals",
      });
    });

    it("should handle non-numeric pagination parameters", async () => {
      prismaMock.proposals.findMany.mockResolvedValue([]);
      prismaMock.proposals.count.mockResolvedValue(0);

      // Act & Assert
      const response = await request(app)
        .get("/api/proposal/approved")
        .query({ page_size: "invalid", page: "invalid" })
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        proposals: [],
        count: 0,
      });

      // Should fall back to defaults for skip and take values
      expect(prismaMock.proposals.findMany).toHaveBeenCalledWith({
        where: { isApproved: true, isRejected: false },
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 10,
      });
    });
  });

  describe("GET /api/proposal/pending", () => {
    it("should return pending proposals with default pagination and no creator filter", async () => {
      const mockCount = 15;

      prismaMock.proposals.findMany.mockResolvedValue(mockProposals);
      prismaMock.proposals.count.mockResolvedValue(mockCount);

      // Act & Assert
      const response = await request(app)
        .get("/api/proposal/pending")
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        proposals: mockProposalsResponse,
        count: mockCount,
      });

      expect(prismaMock.proposals.findMany).toHaveBeenCalledWith({
        where: { isApproved: false, isRejected: false, creatorId: undefined },
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 10,
      });

      expect(prismaMock.proposals.count).toHaveBeenCalledWith({
        where: { isApproved: false, isRejected: false, creatorId: undefined },
      });
    });

    it("should return pending proposals with creator filter and custom pagination", async () => {
      const mockCount = 5;

      prismaMock.proposals.findMany.mockResolvedValue(mockProposals);
      prismaMock.proposals.count.mockResolvedValue(mockCount);

      // Act & Assert
      const response = await request(app)
        .get("/api/proposal/pending")
        .query({ created_by: "user123", page_size: "20", page: "2" })
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        proposals: mockProposalsResponse,
        count: mockCount,
      });

      expect(prismaMock.proposals.findMany).toHaveBeenCalledWith({
        where: { isApproved: false, isRejected: false, creatorId: "user123" },
        orderBy: { createdAt: "desc" },
        skip: 20,
        take: 20,
      });

      expect(prismaMock.proposals.count).toHaveBeenCalledWith({
        where: { isApproved: false, isRejected: false, creatorId: "user123" },
      });
    });

    it("should handle database error gracefully", async () => {
      // Arrange
      const errorMessage = "Database timeout";
      prismaMock.proposals.findMany.mockRejectedValue(new Error(errorMessage));

      // Act & Assert
      const response = await request(app)
        .get("/api/proposal/pending")
        .query({ created_by: "user456" })
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Failed to fetch pending proposals",
      });
    });

    it("should handle empty results", async () => {
      prismaMock.proposals.findMany.mockResolvedValue([]);
      prismaMock.proposals.count.mockResolvedValue(0);

      // Act & Assert
      const response = await request(app)
        .get("/api/proposal/pending")
        .query({ created_by: "nonexistent_user", page_size: "5", page: "1" })
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        proposals: [],
        count: 0,
      });
    });

    it("should handle count operation failing separately", async () => {
      prismaMock.proposals.findMany.mockResolvedValue(mockProposals);
      prismaMock.proposals.count.mockRejectedValue(
        new Error("Count operation failed")
      );

      // Act & Assert
      const response = await request(app)
        .get("/api/proposal/pending")
        .query({ created_by: "user123" })
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Failed to fetch pending proposals",
      });
    });
  });

  describe("GET /api/proposal/:proposal_id/quorum", () => {
    it("should return quorum amount for an approved proposal without override", async () => {
      const mockProposal = {
        id: 1,
        proposalId: "proposal-123",
        isApproved: true,
        isRejected: false,
        totalVenearAtApproval: new Decimal("20000000000000000000000000000000"), // 20M veNEAR
        createdAt: new Date("2024-01-01"),
        votingStartAt: new Date("2024-01-02"),
        votingDurationNs: new Decimal("864000000000000000"),
      };

      prismaMock.proposals.findFirst.mockResolvedValue(mockProposal);
      prismaMock.quorum_overrides.findMany.mockResolvedValue([]);

      // Act & Assert
      const response = await request(app)
        .get("/api/proposal/proposal-123/quorum")
        .expect(200)
        .expect("Content-Type", /json/);

      // 35% of 20M = 7M, which is equal to the floor, so should return 7M
      expect(response.body).toEqual({
        quorumAmount: "7000000000000000000000000000000",
      });

      expect(prismaMock.proposals.findFirst).toHaveBeenCalledWith({
        where: { proposalId: "proposal-123" },
      });

      expect(prismaMock.quorum_overrides.findMany).toHaveBeenCalledWith({
        where: {
          startingFromId: {
            lte: "proposal-123",
          },
        },
        orderBy: {
          startingFromId: "desc",
        },
        take: 1,
      });
    });

    it("should return quorum amount for an approved proposal with percentage override", async () => {
      const mockProposal = {
        id: 1,
        proposalId: "proposal-123",
        isApproved: true,
        isRejected: false,
        totalVenearAtApproval: new Decimal("30000000000000000000000000000000"), // 30M veNEAR
        createdAt: new Date("2024-01-01"),
        votingStartAt: new Date("2024-01-02"),
        votingDurationNs: new Decimal("864000000000000000"),
      };

      const mockQuorumOverride = {
        id: 1,
        startingFromId: "proposal-100",
        overrideType: "percentage",
        overrideValue: "0.5", // 50%
        createdAt: new Date("2024-01-01"),
      };

      prismaMock.proposals.findFirst.mockResolvedValue(mockProposal);
      prismaMock.quorum_overrides.findMany.mockResolvedValue([
        mockQuorumOverride,
      ]);

      // Act & Assert
      const response = await request(app)
        .get("/api/proposal/proposal-123/quorum")
        .expect(200)
        .expect("Content-Type", /json/);

      // 50% of 30M = 15M
      expect(response.body).toEqual({
        quorumAmount: "1500000000000000000000000000",
      });
    });

    it("should return quorum amount for an approved proposal with fixed override", async () => {
      const mockProposal = {
        id: 1,
        proposalId: "proposal-123",
        isApproved: true,
        isRejected: false,
        totalVenearAtApproval: new Decimal("30000000000000000000000000000000"), // 30M veNEAR
        createdAt: new Date("2024-01-01"),
        votingStartAt: new Date("2024-01-02"),
        votingDurationNs: new Decimal("864000000000000000"),
      };

      const mockQuorumOverride = {
        id: 1,
        startingFromId: "proposal-100",
        overrideType: "fixed",
        overrideValue: "10000000000000000000000000000000", // 10M veNEAR
        createdAt: new Date("2024-01-01"),
      };

      prismaMock.proposals.findFirst.mockResolvedValue(mockProposal);
      prismaMock.quorum_overrides.findMany.mockResolvedValue([
        mockQuorumOverride,
      ]);

      // Act & Assert
      const response = await request(app)
        .get("/api/proposal/proposal-123/quorum")
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        quorumAmount: "10000000000000000000000000000000",
      });
    });

    it("should return 404 when proposal is not found", async () => {
      prismaMock.proposals.findFirst.mockResolvedValue(null);

      // Act & Assert
      const response = await request(app)
        .get("/api/proposal/nonexistent/quorum")
        .expect(404)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Proposal not found",
      });
    });

    it("should return 400 when proposal is not approved", async () => {
      const mockProposal = {
        id: 1,
        proposalId: "proposal-123",
        isApproved: false,
        isRejected: false,
        totalVenearAtApproval: null,
        createdAt: new Date("2024-01-01"),
        votingStartAt: null,
        votingDurationNs: null,
      };

      prismaMock.proposals.findFirst.mockResolvedValue(mockProposal);

      // Act & Assert
      const response = await request(app)
        .get("/api/proposal/proposal-123/quorum")
        .expect(400)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Proposal is not approved",
      });
    });

    it("should handle database error gracefully", async () => {
      prismaMock.proposals.findFirst.mockRejectedValue(
        new Error("Database error")
      );

      // Act & Assert
      const response = await request(app)
        .get("/api/proposal/proposal-123/quorum")
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Failed to fetch proposal quorum",
      });
    });

    it("should return quorum amount when proposal has high total voting power", async () => {
      const mockProposal = {
        id: 1,
        proposalId: "proposal-123",
        isApproved: true,
        isRejected: false,
        totalVenearAtApproval: new Decimal("100000000000000000000000000000000"), // 100M veNEAR
        createdAt: new Date("2024-01-01"),
        votingStartAt: new Date("2024-01-02"),
        votingDurationNs: new Decimal("864000000000000000"),
      };

      prismaMock.proposals.findFirst.mockResolvedValue(mockProposal);
      prismaMock.quorum_overrides.findMany.mockResolvedValue([]);

      // Act & Assert
      const response = await request(app)
        .get("/api/proposal/proposal-123/quorum")
        .expect(200)
        .expect("Content-Type", /json/);

      // 35% of 100M = 35M, which is greater than the floor (7M), so should return 35M
      expect(response.body).toEqual({
        quorumAmount: "35000000000000000000000000000000",
      });
    });
  });
});
