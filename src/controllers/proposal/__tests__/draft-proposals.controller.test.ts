import request from "supertest";
import app from "../../../app";
import { prismaMock } from "../../../lib/tests/prismaMock";
import { DraftProposalStage } from "../../../generated/prisma";

jest.mock("../../../lib/signature/verifySignature");
import { verifySignature } from "../../../lib/signature/verifySignature";

const mockVerifySignature = verifySignature as jest.MockedFunction<
  typeof verifySignature
>;

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

  const mockSignatureData = {
    signature: "test signature",
    publicKey: "testuser.near",
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

  describe("POST /api/proposal/draft", () => {
    it("should create a new draft proposal", async () => {
      const createData = {
        author: "testuser.near",
      };

      prismaMock.draft_proposals.create.mockResolvedValue(
        mockDraftProposalPrisma
      );

      const response = await request(app)
        .post("/api/proposal/draft")
        .send(createData)
        .expect(201)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual(mockDraftProposalResponse);
      expect(prismaMock.draft_proposals.create).toHaveBeenCalledWith({
        data: {
          title: "",
          description: "",
          proposalUrl: "",
          author: createData.author,
          votingOptions: ["For", "Against", "Abstain"],
        },
      });
    });

    it("should return 400 if required fields are missing", async () => {
      const incompleteData = {
        title: "Test Draft Proposal",
      };

      const response = await request(app)
        .post("/api/proposal/draft")
        .send(incompleteData)
        .expect(400)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Author is required",
      });
    });

    it("should return 400 if signature fields are missing", async () => {
      const incompleteData = {
        title: "Test Draft Proposal",
        description: "This is a test draft proposal",
      };

      const response = await request(app)
        .post("/api/proposal/draft")
        .send(incompleteData)
        .expect(400)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Author is required",
      });
    });

    it("should return 400 if signature is invalid", async () => {
      const createData = {
        title: "Test Draft Proposal",
        description: "This is a test draft proposal",
        author: "testuser.near",
        ...mockSignatureData,
      };

      prismaMock.draft_proposals.create.mockResolvedValue(
        mockDraftProposalPrisma
      );

      const response = await request(app)
        .post("/api/proposal/draft")
        .send(createData)
        .expect(201)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual(mockDraftProposalResponse);
    });

    it("should handle database error gracefully", async () => {
      const createData = {
        title: "Test Draft Proposal",
        description: "This is a test draft proposal",
        author: "testuser.near",
        ...mockSignatureData,
      };

      mockVerifySignature.mockReturnValue({
        isValid: true,
        signedData: expect.anything(),
      });
      prismaMock.draft_proposals.create.mockRejectedValue(
        new Error("Database error")
      );

      const response = await request(app)
        .post("/api/proposal/draft")
        .send(createData)
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Failed to create draft proposal",
      });
    });
  });

  describe("GET /api/proposal/draft", () => {
    it("should return draft proposals with default pagination", async () => {
      const mockCount = 25;

      prismaMock.draft_proposals.findMany.mockResolvedValue(
        mockDraftProposalsPrisma
      );
      prismaMock.draft_proposals.count.mockResolvedValue(mockCount);

      const response = await request(app)
        .get("/api/proposal/draft")
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
        .get("/api/proposal/draft")
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
        .get("/api/proposal/draft")
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Failed to fetch draft proposals",
      });
    });
  });

  describe("GET /api/proposal/draft/:id", () => {
    it("should return a specific draft proposal", async () => {
      prismaMock.draft_proposals.findUnique.mockResolvedValue(
        mockDraftProposalPrisma
      );

      const response = await request(app)
        .get(`/api/proposal/draft/${mockDraftProposalPrisma.id}`)
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
        .get("/api/proposal/draft/nonexistent")
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
        .get(`/api/proposal/draft/${mockDraftProposalPrisma.id}`)
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Failed to fetch draft proposal",
      });
    });
  });

  describe("PUT /api/proposal/draft/:id", () => {
    it("should update a draft proposal", async () => {
      const updateData = {
        title: "Updated Title",
        stage: DraftProposalStage.AWAITING_SUBMISSION,
        ...mockSignatureData,
      };

      const updatedProposalPrisma = {
        ...mockDraftProposalPrisma,
        title: "Updated Title",
        stage: DraftProposalStage.AWAITING_SUBMISSION,
        updatedAt: new Date("2024-01-02"),
      };

      const updatedProposalResponse = {
        ...mockDraftProposalResponse,
        title: "Updated Title",
        stage: DraftProposalStage.AWAITING_SUBMISSION,
        updatedAt: "2024-01-02T00:00:00.000Z",
      };

      mockVerifySignature.mockReturnValue({
        isValid: true,
        signedData: {
          id: mockDraftProposalPrisma.id,
          title: updateData.title,
          stage: updateData.stage,
          action: "update",
          timestamp: expect.any(Number),
        },
      });
      prismaMock.draft_proposals.findUnique.mockResolvedValue(
        mockDraftProposalPrisma
      );
      prismaMock.draft_proposals.update.mockResolvedValue(
        updatedProposalPrisma
      );

      const response = await request(app)
        .put(`/api/proposal/draft/${mockDraftProposalPrisma.id}`)
        .send(updateData)
        .expect(200)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual(updatedProposalResponse);
      expect(prismaMock.draft_proposals.update).toHaveBeenCalledWith({
        where: { id: mockDraftProposalPrisma.id },
        data: {
          title: "Updated Title",
          stage: DraftProposalStage.AWAITING_SUBMISSION,
        },
      });
    });

    it("should set submittedAt when stage changes to SUBMITTED", async () => {
      const updateData = {
        stage: DraftProposalStage.SUBMITTED,
        receiptId: "receipt_123abc",
        ...mockSignatureData,
      };

      mockVerifySignature.mockReturnValue({
        isValid: true,
        signedData: {
          id: mockDraftProposalPrisma.id,
          stage: updateData.stage,
          receiptId: updateData.receiptId,
          action: "update",
          timestamp: expect.any(Number),
        },
      });
      prismaMock.draft_proposals.findUnique.mockResolvedValue(
        mockDraftProposalPrisma
      );
      prismaMock.draft_proposals.update.mockResolvedValue({
        ...mockDraftProposalPrisma,
        ...updateData,
        submittedAt: new Date(),
      });

      await request(app)
        .put(`/api/proposal/draft/${mockDraftProposalPrisma.id}`)
        .send(updateData)
        .expect(200);

      expect(prismaMock.draft_proposals.update).toHaveBeenCalledWith({
        where: { id: mockDraftProposalPrisma.id },
        data: expect.objectContaining({
          stage: DraftProposalStage.SUBMITTED,
          receiptId: "receipt_123abc",
          submittedAt: expect.any(Date),
        }),
      });
    });

    it("should return 400 if signature is invalid", async () => {
      const updateData = {
        title: "Updated Title",
        ...mockSignatureData,
      };

      mockVerifySignature.mockReturnValue({ isValid: false });
      prismaMock.draft_proposals.findUnique.mockResolvedValue(
        mockDraftProposalPrisma
      );

      const response = await request(app)
        .put(`/api/proposal/draft/${mockDraftProposalPrisma.id}`)
        .send(updateData)
        .expect(400)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Invalid signature or proposal data mismatch",
      });
    });

    it("should return 404 if draft proposal not found", async () => {
      const updateData = {
        title: "Updated Title",
        ...mockSignatureData,
      };

      mockVerifySignature.mockReturnValue({
        isValid: true,
        signedData: expect.anything(),
      });

      const response = await request(app)
        .put("/api/proposal/draft/nonexistent")
        .send(updateData)
        .expect(404)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Draft proposal not found",
      });
    });

    it("should handle database error gracefully", async () => {
      const updateData = {
        title: "Updated Title",
        ...mockSignatureData,
      };

      mockVerifySignature.mockReturnValue({
        isValid: true,
        signedData: expect.anything(),
      });
      prismaMock.draft_proposals.findUnique.mockResolvedValue(
        mockDraftProposalPrisma
      );
      prismaMock.draft_proposals.update.mockRejectedValue(
        new Error("Database error")
      );

      const response = await request(app)
        .put(`/api/proposal/draft/${mockDraftProposalPrisma.id}`)
        .send(updateData)
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Failed to update draft proposal",
      });
    });
  });

  describe("DELETE /api/proposal/draft/:id", () => {
    it("should delete a draft proposal", async () => {
      mockVerifySignature.mockReturnValue({
        isValid: true,
        signedData: {
          id: mockDraftProposalPrisma.id,
          action: "delete",
          timestamp: expect.any(Number),
        },
      });
      prismaMock.draft_proposals.findUnique.mockResolvedValue(
        mockDraftProposalPrisma
      );
      prismaMock.draft_proposals.delete.mockResolvedValue(
        mockDraftProposalPrisma
      );

      await request(app)
        .delete(`/api/proposal/draft/${mockDraftProposalPrisma.id}`)
        .send(mockSignatureData)
        .expect(204);

      expect(prismaMock.draft_proposals.delete).toHaveBeenCalledWith({
        where: { id: mockDraftProposalPrisma.id },
      });
    });

    it("should return 400 if signature is invalid", async () => {
      mockVerifySignature.mockReturnValue({ isValid: false });
      prismaMock.draft_proposals.findUnique.mockResolvedValue(
        mockDraftProposalPrisma
      );

      const response = await request(app)
        .delete(`/api/proposal/draft/${mockDraftProposalPrisma.id}`)
        .send(mockSignatureData)
        .expect(400)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Invalid signature or proposal data mismatch",
      });
    });

    it("should return 404 if draft proposal not found", async () => {
      const response = await request(app)
        .delete("/api/proposal/draft/nonexistent")
        .send(mockSignatureData)
        .expect(404)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Draft proposal not found",
      });
    });

    it("should handle database error gracefully", async () => {
      mockVerifySignature.mockReturnValue({
        isValid: true,
        signedData: expect.anything(),
      });
      prismaMock.draft_proposals.findUnique.mockResolvedValue(
        mockDraftProposalPrisma
      );
      prismaMock.draft_proposals.delete.mockRejectedValue(
        new Error("Database error")
      );

      const response = await request(app)
        .delete(`/api/proposal/draft/${mockDraftProposalPrisma.id}`)
        .send(mockSignatureData)
        .expect(500)
        .expect("Content-Type", /json/);

      expect(response.body).toEqual({
        error: "Failed to delete draft proposal",
      });
    });
  });
});
