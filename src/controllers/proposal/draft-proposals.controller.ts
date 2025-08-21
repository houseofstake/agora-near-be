import { Request, Response } from "express";
import { prisma } from "../..";
import { DraftProposalStage, Prisma } from "../../generated/prisma";
import {
  verifySignedPayload,
  SignedPayload,
} from "../../lib/signature/verifySignature";

interface CreateDraftProposalBody {
  author: string;
}

interface UpdateDraftProposalData {
  title?: string;
  description?: string;
  proposalUrl?: string;
  stage?: DraftProposalStage;
  votingOptions?: any;
  receiptId?: string;
}

interface UpdateDraftProposalBody
  extends SignedPayload<UpdateDraftProposalData> {}

interface UpdateDraftProposalStageBody {
  stage: DraftProposalStage;
  receiptId?: string;
}

interface DeleteDraftProposalData {
  action: "delete";
}

interface DeleteDraftProposalBody
  extends SignedPayload<DeleteDraftProposalData> {}

interface DraftProposalQueryParams {
  author?: string;
  stage?: DraftProposalStage;
  page_size?: string;
  page?: string;
}

export class DraftProposalController {
  // This is used for the initial creation of a draft proposal. It takes no data intentionally to match FE UX expectations.
  // The FE will then prompt the user to fill in the title, description, and proposal URL using updateDraftProposal.
  // Even though this function doesn't validate signatures our biggest risk here is simply spam.
  public createDraftProposal = async (
    req: Request<{}, {}, CreateDraftProposalBody>,
    res: Response
  ): Promise<void> => {
    try {
      const { author } = req.body;

      if (!author) {
        res.status(400).json({ error: "Author is required" });
        return;
      }

      const draftProposal = await prisma.draft_proposals.create({
        data: {
          title: "",
          description: "",
          proposalUrl: "",
          author,
          votingOptions: ["For", "Against", "Abstain"],
        },
      });

      res.status(201).json(draftProposal);
    } catch (error) {
      console.error("Error creating draft proposal:", error);
      res.status(500).json({ error: "Failed to create draft proposal" });
    }
  };

  public getDraftProposals = async (
    req: Request<{}, {}, {}, DraftProposalQueryParams>,
    res: Response
  ): Promise<void> => {
    try {
      const { author, stage, page_size, page } = req.query;
      const pageSize = parseInt(page_size ?? "10") || 10;
      const pageNumber = parseInt(page ?? "1") || 1;

      const where: Prisma.draft_proposalsWhereInput = {};
      if (author) where.author = author;
      if (stage) where.stage = stage;

      const [draftProposals, count] = await Promise.all([
        prisma.draft_proposals.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (pageNumber - 1) * pageSize,
          take: pageSize,
        }),
        prisma.draft_proposals.count({ where }),
      ]);

      res.status(200).json({
        draftProposals,
        count,
        page: pageNumber,
        pageSize,
        totalPages: Math.ceil(count / pageSize),
      });
    } catch (error) {
      console.error("Error fetching draft proposals:", error);
      res.status(500).json({ error: "Failed to fetch draft proposals" });
    }
  };

  public getDraftProposalById = async (
    req: Request<{ id: string }>,
    res: Response
  ): Promise<void> => {
    try {
      const { id } = req.params;

      const draftProposal = await prisma.draft_proposals.findUnique({
        where: { id },
      });

      if (!draftProposal) {
        res.status(404).json({ error: "Draft proposal not found" });
        return;
      }

      res.status(200).json(draftProposal);
    } catch (error) {
      console.error("Error fetching draft proposal:", error);
      res.status(500).json({ error: "Failed to fetch draft proposal" });
    }
  };

  public updateDraftProposal = async (
    req: Request<
      { id: string },
      {},
      UpdateDraftProposalBody,
      { network_id?: string }
    >,
    res: Response
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { signature, publicKey, message, data: updateData } = req.body;
      const { network_id } = req.query;

      if (!signature || !publicKey || !message) {
        res
          .status(400)
          .json({ error: "Signature, public key, and message are required" });
        return;
      }

      const existingProposal = await prisma.draft_proposals.findUnique({
        where: { id },
      });

      if (!existingProposal) {
        res.status(404).json({ error: "Draft proposal not found" });
        return;
      }

      const networkId = network_id || "mainnet";
      const isVerified = await verifySignedPayload({
        signedPayload: { signature, publicKey, message, data: updateData },
        networkId,
        accountId: existingProposal.author,
      });

      if (!isVerified) {
        res.status(400).json({ error: "Invalid signature" });
        return;
      }

      const updatedData: any = {
        title: updateData.title,
        description: updateData.description,
        proposalUrl: updateData.proposalUrl,
        stage: updateData.stage,
        votingOptions: updateData.votingOptions,
        receiptId: updateData.receiptId,
      };

      Object.keys(updatedData).forEach((key) => {
        if (updatedData[key] === undefined) {
          delete updatedData[key];
        }
      });

      if (
        updateData.stage === DraftProposalStage.SUBMITTED &&
        !existingProposal.submittedAt
      ) {
        updatedData.submittedAt = new Date();
      }

      const updatedProposal = await prisma.draft_proposals.update({
        where: { id },
        data: updatedData,
      });

      res.status(200).json(updatedProposal);
    } catch (error) {
      console.error("Error updating draft proposal:", error);
      res.status(500).json({ error: "Failed to update draft proposal" });
    }
  };

  // This is used to update the stage of a draft proposal. It is used to move the proposal from draft to submitted.
  // Even though this function doesn't validate signatures our biggest risk here is simply spam.
  public updateDraftProposalStage = async (
    req: Request<{ id: string }, {}, UpdateDraftProposalStageBody>,
    res: Response
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { stage, receiptId } = req.body;

      if (!stage) {
        res.status(400).json({ error: "Stage is required" });
        return;
      }

      const existingProposal = await prisma.draft_proposals.findUnique({
        where: { id },
      });

      if (!existingProposal) {
        res.status(404).json({ error: "Draft proposal not found" });
        return;
      }

      const updatedData: Prisma.draft_proposalsUpdateInput = {
        stage,
        receiptId,
      };

      if (
        stage === DraftProposalStage.SUBMITTED &&
        !existingProposal.submittedAt
      ) {
        updatedData.submittedAt = new Date();
      }

      const updatedProposal = await prisma.draft_proposals.update({
        where: { id },
        data: updatedData,
      });

      res.status(200).json(updatedProposal);
    } catch (error) {
      console.error("Error updating draft proposal stage:", error);
      res.status(500).json({ error: "Failed to update draft proposal stage" });
    }
  };

  public deleteDraftProposal = async (
    req: Request<
      { id: string },
      {},
      DeleteDraftProposalBody,
      { network_id?: string }
    >,
    res: Response
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { signature, publicKey, message } = req.body;
      const { network_id } = req.query;

      if (!signature || !publicKey || !message) {
        res
          .status(400)
          .json({ error: "Signature, public key, and message are required" });
        return;
      }

      const existingProposal = await prisma.draft_proposals.findUnique({
        where: { id },
      });

      if (!existingProposal) {
        res.status(404).json({ error: "Draft proposal not found" });
        return;
      }

      const networkId = network_id || "mainnet";
      const isVerified = await verifySignedPayload({
        signedPayload: {
          signature,
          publicKey,
          message,
          data: { action: "delete" },
        },
        networkId,
        accountId: existingProposal.author,
      });

      if (!isVerified) {
        res.status(400).json({ error: "Invalid signature" });
        return;
      }

      await prisma.draft_proposals.delete({
        where: { id },
      });

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting draft proposal:", error);
      res.status(500).json({ error: "Failed to delete draft proposal" });
    }
  };
}
