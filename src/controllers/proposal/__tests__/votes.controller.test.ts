import request from "supertest";
import app from "../../../app";
import { Decimal } from "@prisma/client/runtime/client";
import { prismaMock } from "../../../lib/tests/prismaMock";

describe("ProposalVotingHistoryController", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation();

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe("GET /api/proposal/:proposal_id/votes", () => {
    it("should return proposal voting history with default pagination", async () => {
      // Arrange
      const mockVotingHistory = [
        {
          proposalId: 1,
          voterId: "user1.near",
          votingPower: new Decimal("1000000000000000000000000"),
          voteOption: 1,
          votedAt: new Date("2024-01-01"),
        },
        {
          proposalId: 1,
          voterId: "user2.near",
          votingPower: new Decimal("500000000000000000000000"),
          voteOption: 0,
          votedAt: new Date("2024-01-02"),
        },
      ];
      const mockCount = 50;

      prismaMock.proposalVotingHistory.findMany.mockResolvedValue(
        mockVotingHistory
      );
      prismaMock.proposalVotingHistory.count.mockResolvedValue(mockCount);

      // Act & Assert
      const response = await request(app)
        .get("/api/proposal/1/votes")
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        votes: [
          {
            accountId: "user1.near",
            votingPower: "1000000000000000000000000",
            voteOption: "1",
          },
          {
            accountId: "user2.near",
            votingPower: "500000000000000000000000",
            voteOption: "0",
          },
        ],
        count: mockCount,
      });

      expect(prismaMock.proposalVotingHistory.findMany).toHaveBeenCalledWith({
        where: { proposalId: 1 },
        skip: 0,
        take: 10,
        orderBy: [
          { votingPower: "desc" },
          { voterId: "asc" },
        ],
      });

      expect(prismaMock.proposalVotingHistory.count).toHaveBeenCalledWith({
        where: { proposalId: 1 },
      });
    });

    it("should return proposal voting history with custom pagination", async () => {
      // Arrange
      const mockVotingHistory = [
        {
          proposalId: 2,
          voterId: "user3.near",
          votingPower: new Decimal("750000000000000000000000"),
          voteOption: 1,
          votedAt: new Date("2024-01-03"),
        },
      ];
      const mockCount = 25;

      prismaMock.proposalVotingHistory.findMany.mockResolvedValue(
        mockVotingHistory
      );
      prismaMock.proposalVotingHistory.count.mockResolvedValue(mockCount);

      // Act & Assert
      const response = await request(app)
        .get("/api/proposal/2/votes")
        .query({ page_size: "5", page: "3" })
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        votes: [
          {
            accountId: "user3.near",
            votingPower: "750000000000000000000000",
            voteOption: "1",
          },
        ],
        count: mockCount,
      });

      expect(prismaMock.proposalVotingHistory.findMany).toHaveBeenCalledWith({
        where: { proposalId: 2 },
        skip: 10,
        take: 5,
        orderBy: [
          { votingPower: "desc" },
          { voterId: "asc" },
        ],
      });

      expect(prismaMock.proposalVotingHistory.count).toHaveBeenCalledWith({
        where: { proposalId: 2 },
      });
    });

    it("should handle null voting power gracefully", async () => {
      // Arrange
      const mockVotingHistory = [
        {
          proposalId: 1,
          voterId: "user4.near",
          votingPower: null,
          voteOption: 1,
          votedAt: new Date("2024-01-01"),
        },
      ];
      const mockCount = 1;

      prismaMock.proposalVotingHistory.findMany.mockResolvedValue(
        mockVotingHistory
      );
      prismaMock.proposalVotingHistory.count.mockResolvedValue(mockCount);

      // Act & Assert
      const response = await request(app)
        .get("/api/proposal/1/votes")
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        votes: [
          {
            accountId: "user4.near",
            votingPower: "0",
            voteOption: "1",
          },
        ],
        count: mockCount,
      });
    });

    it("should handle database error gracefully", async () => {
      // Arrange
      const errorMessage = "Database connection failed";
      prismaMock.proposalVotingHistory.findMany.mockRejectedValue(
        new Error(errorMessage)
      );

      // Act & Assert
      const response = await request(app)
        .get("/api/proposal/1/votes")
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Failed to fetch proposal voting history",
      });
    });

    it("should handle non-numeric pagination parameters", async () => {
      prismaMock.proposalVotingHistory.findMany.mockResolvedValue([]);
      prismaMock.proposalVotingHistory.count.mockResolvedValue(0);

      // Act & Assert
      const response = await request(app)
        .get("/api/proposal/1/votes")
        .query({ page_size: "invalid", page: "invalid" })
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        votes: [],
        count: 0,
      });

      expect(prismaMock.proposalVotingHistory.findMany).toHaveBeenCalledWith({
        where: { proposalId: 1 },
        skip: 0,
        take: 10,
        orderBy: [
          { votingPower: "desc" },
          { voterId: "asc" },
        ],
      });
    });

    it("should handle count operation failing separately", async () => {
      // Arrange
      const mockVotingHistory = [
        {
          proposalId: 1,
          voterId: "user1.near",
          votingPower: new Decimal("1000000000000000000000000"),
          voteOption: 1,
          votedAt: new Date("2024-01-01"),
        },
      ];

      prismaMock.proposalVotingHistory.findMany.mockResolvedValue(
        mockVotingHistory
      );
      prismaMock.proposalVotingHistory.count.mockRejectedValue(
        new Error("Count operation failed")
      );

      // Act & Assert
      const response = await request(app)
        .get("/api/proposal/1/votes")
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Failed to fetch proposal voting history",
      });
    });
  });

  describe("GET /api/proposal/:proposal_id/charts", () => {
    it("should return proposal voting charts data", async () => {
      // Arrange
      const mockVotingHistory = [
        {
          proposalId: 1,
          voterId: "user1.near",
          votingPower: new Decimal("1000000000000000000000000"),
          voteOption: 1,
          votedAt: new Date("2024-01-01T10:00:00.000Z"),
        },
        {
          proposalId: 1,
          voterId: "user2.near",
          votingPower: new Decimal("500000000000000000000000"),
          voteOption: 0,
          votedAt: new Date("2024-01-02T12:00:00.000Z"),
        },
      ];

      prismaMock.proposalVotingHistory.findMany.mockResolvedValue(
        mockVotingHistory
      );

      // Act & Assert
      const response = await request(app)
        .get("/api/proposal/1/charts")
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        data: [
          {
            accountId: "user1.near",
            votingPower: "1000000000000000000000000",
            voteOption: "1",
            votedAt: "2024-01-01T10:00:00.000Z",
          },
          {
            accountId: "user2.near",
            votingPower: "500000000000000000000000",
            voteOption: "0",
            votedAt: "2024-01-02T12:00:00.000Z",
          },
        ],
      });

      expect(prismaMock.proposalVotingHistory.findMany).toHaveBeenCalledWith({
        where: { proposalId: 1 },
        orderBy: {
          votedAt: "asc",
        },
      });
    });

    it("should handle null voting power in charts data", async () => {
      // Arrange
      const mockVotingHistory = [
        {
          proposalId: 1,
          voterId: "user1.near",
          votingPower: null,
          voteOption: 1,
          votedAt: new Date("2024-01-01T10:00:00.000Z"),
        },
      ];

      prismaMock.proposalVotingHistory.findMany.mockResolvedValue(
        mockVotingHistory
      );

      // Act & Assert
      const response = await request(app)
        .get("/api/proposal/1/charts")
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        data: [
          {
            accountId: "user1.near",
            votingPower: "0",
            voteOption: "1",
            votedAt: "2024-01-01T10:00:00.000Z",
          },
        ],
      });
    });

    it("should handle empty results for charts data", async () => {
      prismaMock.proposalVotingHistory.findMany.mockResolvedValue([]);

      // Act & Assert
      const response = await request(app)
        .get("/api/proposal/1/charts")
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        data: [],
      });
    });

    it("should handle database error gracefully for charts data", async () => {
      // Arrange
      const errorMessage = "Database timeout";
      prismaMock.proposalVotingHistory.findMany.mockRejectedValue(
        new Error(errorMessage)
      );

      // Act & Assert
      const response = await request(app)
        .get("/api/proposal/1/charts")
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Failed to fetch proposal voting charts data",
      });
    });
  });

  describe("GET /api/proposal/:proposal_id/non-voters", () => {
    it("should return proposal non-voters with default pagination", async () => {
      // Arrange
      const mockNonVoters = [
        {
          id: "1",
          proposal_id: 1,
          registered_voter_id: "nonvoter1.near",
          current_voting_power: new Decimal("1000000000000000000000000"),
        },
        {
          id: "2",
          proposal_id: 1,
          registered_voter_id: "nonvoter2.near",
          current_voting_power: new Decimal("500000000000000000000000"),
        },
      ];
      const mockCount = 25;

      prismaMock.$queryRaw.mockResolvedValue(mockNonVoters);
      prismaMock.proposalNonVoters.count.mockResolvedValue(mockCount);

      // Act & Assert
      const response = await request(app)
        .get("/api/proposal/1/non-voters")
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        nonVoters: [
          {
            id: "1",
            proposalId: 1,
            registeredVoterId: "nonvoter1.near",
            votingPower: "1000000000000000000000000",
          },
          {
            id: "2",
            proposalId: 1,
            registeredVoterId: "nonvoter2.near",
            votingPower: "500000000000000000000000",
          },
        ],
        count: mockCount,
      });

      expect(prismaMock.$queryRaw).toHaveBeenCalled();

      expect(prismaMock.proposalNonVoters.count).toHaveBeenCalledWith({
        where: { proposalId: 1 },
      });
    });

    it("should return proposal non-voters with custom pagination", async () => {
      // Arrange
      const mockNonVoters = [
        {
          id: "3",
          proposal_id: 2,
          registered_voter_id: "nonvoter3.near",
          current_voting_power: new Decimal("750000000000000000000000"),
        },
      ];
      const mockCount = 12;

      prismaMock.$queryRaw.mockResolvedValue(mockNonVoters);
      prismaMock.proposalNonVoters.count.mockResolvedValue(mockCount);

      // Act & Assert
      const response = await request(app)
        .get("/api/proposal/2/non-voters")
        .query({ page_size: "15", page: "2" })
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        nonVoters: [
          {
            id: "3",
            proposalId: 2,
            registeredVoterId: "nonvoter3.near",
            votingPower: "750000000000000000000000",
          },
        ],
        count: mockCount,
      });

      expect(prismaMock.$queryRaw).toHaveBeenCalled();

      expect(prismaMock.proposalNonVoters.count).toHaveBeenCalledWith({
        where: { proposalId: 2 },
      });
    });

    it("should handle empty results for non-voters", async () => {
      prismaMock.$queryRaw.mockResolvedValue([]);
      prismaMock.proposalNonVoters.count.mockResolvedValue(0);

      // Act & Assert
      const response = await request(app)
        .get("/api/proposal/1/non-voters")
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        nonVoters: [],
        count: 0,
      });
    });

    it("should handle database error gracefully for non-voters", async () => {
      // Arrange
      const errorMessage = "Database connection lost";
      prismaMock.$queryRaw.mockRejectedValue(new Error(errorMessage));

      // Act & Assert
      const response = await request(app)
        .get("/api/proposal/1/non-voters")
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Failed to fetch proposal non voters",
      });
    });

    it("should handle non-numeric pagination parameters for non-voters", async () => {
      prismaMock.$queryRaw.mockResolvedValue([]);
      prismaMock.proposalNonVoters.count.mockResolvedValue(0);

      // Act & Assert
      const response = await request(app)
        .get("/api/proposal/1/non-voters")
        .query({ page_size: "invalid", page: "invalid" })
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        nonVoters: [],
        count: 0,
      });

      expect(prismaMock.$queryRaw).toHaveBeenCalled();
    });

    it("should handle count operation failing separately for non-voters", async () => {
      // Arrange
      const mockNonVoters = [
        {
          id: "1",
          proposal_id: 1,
          registered_voter_id: "nonvoter1.near",
          current_voting_power: new Decimal("1000000000000000000000000"),
        },
      ];

      prismaMock.$queryRaw.mockResolvedValue(mockNonVoters);
      prismaMock.proposalNonVoters.count.mockRejectedValue(
        new Error("Count operation failed")
      );

      // Act & Assert
      const response = await request(app)
        .get("/api/proposal/1/non-voters")
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Failed to fetch proposal non voters",
      });
    });
  });
});
