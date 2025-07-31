import request from "supertest";
import app from "../../../app";
import { prismaMock } from "../../../lib/tests/prismaMock";
import { DraftProposalStage } from "../../../generated/prisma";

describe("DraftProposalController", () => {
  const mockDraftProposalPrisma = {
    id: "clp1234567890",
    title: "Test Draft Proposal",
    description: "This is a test draft proposal",
    proposalUrl: "https://example.com/proposal",
    author: "testuser.near",
    stage: DraftProposalStage.DRAFT,
    votingOptions: { options: ["For", "Against", "Abstain"] },
    receiptId: null,
    submittedAt: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  };

  // Expected response data (with ISO strings)
  const mockDraftProposalResponse = {
    id: "clp1234567890",
    title: "Test Draft Proposal",
    description: "This is a test draft proposal",
    proposalUrl: "https://example.com/proposal",
    author: "testuser.near",
    stage: DraftProposalStage.DRAFT,
    votingOptions: { options: ["For", "Against", "Abstain"] },
    receiptId: null,
    submittedAt: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  const mockDraftProposalsPrisma = [mockDraftProposalPrisma];
  const mockDraftProposalsResponse = [mockDraftProposalResponse];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/draft-proposal", () => {
    it("should create a new draft proposal", async () => {
      const createData = {
        title: "Test Draft Proposal",
        description: "This is a test draft proposal",
        author: "testuser.near",
        proposalUrl: "https://example.com/proposal",
        votingOptions: { options: ["For", "Against", "Abstain"] },
      };

      prismaMock.draft_proposals.create.mockResolvedValue(
        mockDraftProposalPrisma
      );

      const response = await request(app)
        .post("/api/draft-proposal")
        .send(createData)
        .expect(201)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual(mockDraftProposalResponse);
      expect(prismaMock.draft_proposals.create).toHaveBeenCalledWith({
        data: {
          title: createData.title,
          description: createData.description,
          proposalUrl: createData.proposalUrl,
          author: createData.author,
          votingOptions: createData.votingOptions,
        },
      });
    });

    it("should return 400 if required fields are missing", async () => {
      const incompleteData = {
        title: "Test Draft Proposal",
      };

      const response = await request(app)
        .post("/api/draft-proposal")
        .send(incompleteData)
        .expect(400)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Title, description, and author are required",
      });
    });

    it("should handle database error gracefully", async () => {
      const createData = {
        title: "Test Draft Proposal",
        description: "This is a test draft proposal",
        author: "testuser.near",
      };

      prismaMock.draft_proposals.create.mockRejectedValue(
        new Error("Database error")
      );

      const response = await request(app)
        .post("/api/draft-proposal")
        .send(createData)
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Failed to create draft proposal",
      });
    });
  });

  describe("GET /api/draft-proposal", () => {
    it("should return draft proposals with default pagination", async () => {
      const mockCount = 25;

      prismaMock.draft_proposals.findMany.mockResolvedValue(
        mockDraftProposalsPrisma
      );
      prismaMock.draft_proposals.count.mockResolvedValue(mockCount);

      const response = await request(app)
        .get("/api/draft-proposal")
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        draftProposals: mockDraftProposalsResponse,
        count: mockCount,
        page: 1,
        pageSize: 10,
        totalPages: 3,
      });

      expect(prismaMock.draft_proposals.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 10,
      });
    });

    it("should filter by author and stage", async () => {
      const mockCount = 5;

      prismaMock.draft_proposals.findMany.mockResolvedValue(
        mockDraftProposalsPrisma
      );
      prismaMock.draft_proposals.count.mockResolvedValue(mockCount);

      const response = await request(app)
        .get("/api/draft-proposal")
        .query({
          author: "testuser.near",
          stage: DraftProposalStage.DRAFT,
          page_size: "5",
          page: "2",
        })
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        draftProposals: mockDraftProposalsResponse,
        count: mockCount,
        page: 2,
        pageSize: 5,
        totalPages: 1,
      });

      expect(prismaMock.draft_proposals.findMany).toHaveBeenCalledWith({
        where: {
          author: "testuser.near",
          stage: DraftProposalStage.DRAFT,
        },
        orderBy: { createdAt: "desc" },
        skip: 5,
        take: 5,
      });
    });

    it("should handle database error gracefully", async () => {
      prismaMock.draft_proposals.findMany.mockRejectedValue(
        new Error("Database error")
      );

      const response = await request(app)
        .get("/api/draft-proposal")
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Failed to fetch draft proposals",
      });
    });
  });

  describe("GET /api/draft-proposal/:id", () => {
    it("should return a specific draft proposal", async () => {
      prismaMock.draft_proposals.findUnique.mockResolvedValue(
        mockDraftProposalPrisma
      );

      const response = await request(app)
        .get(`/api/draft-proposal/${mockDraftProposalPrisma.id}`)
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual(mockDraftProposalResponse);
      expect(prismaMock.draft_proposals.findUnique).toHaveBeenCalledWith({
        where: { id: mockDraftProposalPrisma.id },
      });
    });

    it("should return 404 if draft proposal not found", async () => {
      prismaMock.draft_proposals.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get("/api/draft-proposal/nonexistent")
        .expect(404)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Draft proposal not found",
      });
    });

    it("should handle database error gracefully", async () => {
      prismaMock.draft_proposals.findUnique.mockRejectedValue(
        new Error("Database error")
      );

      const response = await request(app)
        .get(`/api/draft-proposal/${mockDraftProposalPrisma.id}`)
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Failed to fetch draft proposal",
      });
    });
  });

  describe("PUT /api/draft-proposal/:id", () => {
    it("should update a draft proposal", async () => {
      const updateData = {
        title: "Updated Title",
        stage: DraftProposalStage.AWAITING_SUBMISSION,
      };

      const updatedProposalPrisma = {
        ...mockDraftProposalPrisma,
        ...updateData,
        updatedAt: new Date("2024-01-02"),
      };

      const updatedProposalResponse = {
        ...mockDraftProposalResponse,
        ...updateData,
        updatedAt: "2024-01-02T00:00:00.000Z",
      };

      prismaMock.draft_proposals.findUnique.mockResolvedValue(
        mockDraftProposalPrisma
      );
      prismaMock.draft_proposals.update.mockResolvedValue(
        updatedProposalPrisma
      );

      const response = await request(app)
        .put(`/api/draft-proposal/${mockDraftProposalPrisma.id}`)
        .send(updateData)
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual(updatedProposalResponse);
      expect(prismaMock.draft_proposals.update).toHaveBeenCalledWith({
        where: { id: mockDraftProposalPrisma.id },
        data: updateData,
      });
    });

    it("should set submittedAt when stage changes to SUBMITTED", async () => {
      const updateData = {
        stage: DraftProposalStage.SUBMITTED,
        receiptId: "receipt_123abc",
      };

      prismaMock.draft_proposals.findUnique.mockResolvedValue(
        mockDraftProposalPrisma
      );
      prismaMock.draft_proposals.update.mockResolvedValue({
        ...mockDraftProposalPrisma,
        ...updateData,
        submittedAt: new Date(),
      });

      await request(app)
        .put(`/api/draft-proposal/${mockDraftProposalPrisma.id}`)
        .send(updateData)
        .expect(200);

      expect(prismaMock.draft_proposals.update).toHaveBeenCalledWith({
        where: { id: mockDraftProposalPrisma.id },
        data: expect.objectContaining({
          ...updateData,
          submittedAt: expect.any(Date),
        }),
      });
    });

    it("should return 404 if draft proposal not found", async () => {
      prismaMock.draft_proposals.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .put("/api/draft-proposal/nonexistent")
        .send({ title: "Updated Title" })
        .expect(404)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Draft proposal not found",
      });
    });

    it("should handle database error gracefully", async () => {
      prismaMock.draft_proposals.findUnique.mockResolvedValue(
        mockDraftProposalPrisma
      );
      prismaMock.draft_proposals.update.mockRejectedValue(
        new Error("Database error")
      );

      const response = await request(app)
        .put(`/api/draft-proposal/${mockDraftProposalPrisma.id}`)
        .send({ title: "Updated Title" })
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Failed to update draft proposal",
      });
    });
  });

  describe("DELETE /api/draft-proposal/:id", () => {
    it("should delete a draft proposal", async () => {
      prismaMock.draft_proposals.findUnique.mockResolvedValue(
        mockDraftProposalPrisma
      );
      prismaMock.draft_proposals.delete.mockResolvedValue(
        mockDraftProposalPrisma
      );

      await request(app)
        .delete(`/api/draft-proposal/${mockDraftProposalPrisma.id}`)
        .expect(204);

      expect(prismaMock.draft_proposals.delete).toHaveBeenCalledWith({
        where: { id: mockDraftProposalPrisma.id },
      });
    });

    it("should return 404 if draft proposal not found", async () => {
      prismaMock.draft_proposals.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .delete("/api/draft-proposal/nonexistent")
        .expect(404)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Draft proposal not found",
      });
    });

    it("should handle database error gracefully", async () => {
      prismaMock.draft_proposals.findUnique.mockResolvedValue(
        mockDraftProposalPrisma
      );
      prismaMock.draft_proposals.delete.mockRejectedValue(
        new Error("Database error")
      );

      const response = await request(app)
        .delete(`/api/draft-proposal/${mockDraftProposalPrisma.id}`)
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Failed to delete draft proposal",
      });
    });
  });
});
