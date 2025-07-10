import request from "supertest";
import app from "../../../app";
import { prismaPublicMock } from "../../../lib/tests/prismaPublicMock";

describe("ProposalController", () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe("GET /api/proposal/approved", () => {
    it("should return approved proposals with default pagination", async () => {
      // Arrange
      const mockProposals = [
        {
          id: 1,
          title: "Proposal 1",
          isApproved: true,
          isRejected: false,
          createdAt: new Date("2024-01-01"),
        },
        {
          id: 2,
          title: "Proposal 2",
          isApproved: true,
          isRejected: false,
          createdAt: new Date("2024-01-02"),
        },
      ];
      const mockCount = 50;

      prismaPublicMock.proposal.findMany.mockResolvedValue(mockProposals);
      prismaPublicMock.proposal.count.mockResolvedValue(mockCount);

      // Act & Assert
      const response = await request(app)
        .get("/api/proposal/approved")
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        proposals: [
          {
            id: 1,
            title: "Proposal 1",
            isApproved: true,
            isRejected: false,
            createdAt: "2024-01-01T00:00:00.000Z",
          },
          {
            id: 2,
            title: "Proposal 2",
            isApproved: true,
            isRejected: false,
            createdAt: "2024-01-02T00:00:00.000Z",
          },
        ],
        count: mockCount,
      });

      expect(prismaPublicMock.proposal.findMany).toHaveBeenCalledWith({
        where: { isApproved: true, isRejected: false },
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 10,
      });

      expect(prismaPublicMock.proposal.count).toHaveBeenCalledWith({
        where: { isApproved: true, isRejected: false },
      });
    });

    it("should return approved proposals with custom pagination", async () => {
      // Arrange
      const mockProposals = [
        {
          id: 3,
          title: "Proposal 3",
          isApproved: true,
          isRejected: false,
          createdAt: new Date("2024-01-03"),
        },
      ];
      const mockCount = 25;

      prismaPublicMock.proposal.findMany.mockResolvedValue(mockProposals);
      prismaPublicMock.proposal.count.mockResolvedValue(mockCount);

      // Act & Assert
      const response = await request(app)
        .get("/api/proposal/approved")
        .query({ page_size: "5", page: "3" })
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        proposals: [
          {
            id: 3,
            title: "Proposal 3",
            isApproved: true,
            isRejected: false,
            createdAt: "2024-01-03T00:00:00.000Z",
          },
        ],
        count: mockCount,
      });

      expect(prismaPublicMock.proposal.findMany).toHaveBeenCalledWith({
        where: { isApproved: true, isRejected: false },
        orderBy: { createdAt: "desc" },
        skip: 10,
        take: 5,
      });

      expect(prismaPublicMock.proposal.count).toHaveBeenCalledWith({
        where: { isApproved: true, isRejected: false },
      });
    });

    it("should handle database error gracefully", async () => {
      // Arrange
      const errorMessage = "Database connection failed";
      prismaPublicMock.proposal.findMany.mockRejectedValue(
        new Error(errorMessage)
      );

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
      prismaPublicMock.proposal.findMany.mockResolvedValue([]);
      prismaPublicMock.proposal.count.mockResolvedValue(0);

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
      expect(prismaPublicMock.proposal.findMany).toHaveBeenCalledWith({
        where: { isApproved: true, isRejected: false },
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 10,
      });
    });
  });

  describe("GET /api/proposal/pending", () => {
    it("should return pending proposals with default pagination and no creator filter", async () => {
      // Arrange
      const mockProposals = [
        {
          id: 1,
          title: "Pending Proposal 1",
          isApproved: false,
          isRejected: false,
          createdAt: new Date("2024-01-01"),
        },
      ];
      const mockCount = 15;

      prismaPublicMock.proposal.findMany.mockResolvedValue(mockProposals);
      prismaPublicMock.proposal.count.mockResolvedValue(mockCount);

      // Act & Assert
      const response = await request(app)
        .get("/api/proposal/pending")
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        proposals: [
          {
            id: 1,
            title: "Pending Proposal 1",
            isApproved: false,
            isRejected: false,
            createdAt: "2024-01-01T00:00:00.000Z",
          },
        ],
        count: mockCount,
      });

      expect(prismaPublicMock.proposal.findMany).toHaveBeenCalledWith({
        where: { isApproved: false, isRejected: false, creatorId: undefined },
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 10,
      });

      expect(prismaPublicMock.proposal.count).toHaveBeenCalledWith({
        where: { isApproved: false, isRejected: false, creatorId: undefined },
      });
    });

    it("should return pending proposals with creator filter and custom pagination", async () => {
      // Arrange
      const mockProposals = [
        {
          id: 2,
          title: "Pending Proposal 2",
          isApproved: false,
          isRejected: false,
          creatorId: "user123",
          createdAt: new Date("2024-01-02"),
        },
      ];
      const mockCount = 5;

      prismaPublicMock.proposal.findMany.mockResolvedValue(mockProposals);
      prismaPublicMock.proposal.count.mockResolvedValue(mockCount);

      // Act & Assert
      const response = await request(app)
        .get("/api/proposal/pending")
        .query({ created_by: "user123", page_size: "20", page: "2" })
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        proposals: [
          {
            id: 2,
            title: "Pending Proposal 2",
            isApproved: false,
            isRejected: false,
            creatorId: "user123",
            createdAt: "2024-01-02T00:00:00.000Z",
          },
        ],
        count: mockCount,
      });

      expect(prismaPublicMock.proposal.findMany).toHaveBeenCalledWith({
        where: { isApproved: false, isRejected: false, creatorId: "user123" },
        orderBy: { createdAt: "desc" },
        skip: 20,
        take: 20,
      });

      expect(prismaPublicMock.proposal.count).toHaveBeenCalledWith({
        where: { isApproved: false, isRejected: false, creatorId: "user123" },
      });
    });

    it("should handle database error gracefully", async () => {
      // Arrange
      const errorMessage = "Database timeout";
      prismaPublicMock.proposal.findMany.mockRejectedValue(
        new Error(errorMessage)
      );

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
      prismaPublicMock.proposal.findMany.mockResolvedValue([]);
      prismaPublicMock.proposal.count.mockResolvedValue(0);

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
      // Arrange
      const mockProposals = [
        {
          id: 1,
          title: "Proposal 1",
          isApproved: false,
          isRejected: false,
          creatorId: "user123",
          createdAt: new Date("2024-01-01"),
        },
      ];

      prismaPublicMock.proposal.findMany.mockResolvedValue(mockProposals);
      prismaPublicMock.proposal.count.mockRejectedValue(
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
