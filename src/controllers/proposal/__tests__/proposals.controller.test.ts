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
      status: "Voting",
      votingDurationNs: "864000000000000000",
      votingStartTimeNs: "1704153600000000000",
      votingCreatedAtNs: "1704067200000000000",
    },
    {
      id: 2,
      isApproved: true,
      isRejected: false,
      createdAt: "2024-01-01T00:00:00.000Z",
      forVotingPower: "1",
      againstVotingPower: "2",
      abstainVotingPower: "3",
      status: "Voting",
      votingDurationNs: "864000000000000000",
      votingStartTimeNs: "1704153600000000000",
      votingCreatedAtNs: "1704067200000000000",
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
});
