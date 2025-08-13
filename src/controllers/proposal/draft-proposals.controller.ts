import { Request, Response } from "express";
import { prisma } from "../..";
import { DraftProposalStage } from "../../generated/prisma";
import { verifySignature } from "../../lib/signature/verifySignature";

interface CreateDraftProposalBody {
  title: string;
  description: string;
  proposalUrl?: string;
  author: string;
  votingOptions?: any;
  message: string;
  signature: string;
  publicKey: string;
}

interface UpdateDraftProposalBody {
  title?: string;
  description?: string;
  proposalUrl?: string;
  stage?: DraftProposalStage;
  votingOptions?: any;
  receiptId?: string;
  message: string;
  signature: string;
  publicKey: string;
}

interface DraftProposalQueryParams {
  author?: string;
  stage?: DraftProposalStage;
  page_size?: string;
  page?: string;
}

export class DraftProposalController {
  public createDraftProposal = async (
    req: Request<{}, {}, CreateDraftProposalBody>,
    res: Response
  ): Promise<void> => {
    try {
      const {
        title,
        description,
        proposalUrl,
        author,
        votingOptions,
        message,
        signature,
        publicKey,
      } = req.body;

      if (!author) {
        res.status(400).json({ error: "Author is required" });
        return;
      }

      if (!message || !signature || !publicKey) {
        res
          .status(400)
          .json({ error: "Message, signature, and public key are required" });
        return;
      }

      const isVerified = verifySignature({
        message,
        signature,
        publicKey,
      });

      if (!isVerified) {
        res.status(400).json({ error: "Invalid signature" });
        return;
      }

      const draftProposal = await prisma.draft_proposals.create({
        data: {
          title,
          description,
          proposalUrl,
          author,
          votingOptions,
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

      const where: any = {};
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
    req: Request<{ id: string }, {}, UpdateDraftProposalBody>,
    res: Response
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { message, signature, publicKey, ...updateData } = req.body;

      if (!message || !signature || !publicKey) {
        res
          .status(400)
          .json({ error: "Message, signature, and public key are required" });
        return;
      }

      const existingProposal = await prisma.draft_proposals.findUnique({
        where: { id },
      });

      if (!existingProposal) {
        res.status(404).json({ error: "Draft proposal not found" });
        return;
      }

      const isVerified = verifySignature({
        message,
        signature,
        publicKey,
      });

      if (!isVerified) {
        res.status(400).json({ error: "Invalid signature" });
        return;
      }

      const updatedData: any = { ...updateData };
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

  public deleteDraftProposal = async (
    req: Request<
      { id: string },
      {},
      { message: string; signature: string; publicKey: string }
    >,
    res: Response
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { message, signature, publicKey } = req.body;

      if (!message || !signature || !publicKey) {
        res
          .status(400)
          .json({ error: "Message, signature, and public key are required" });
        return;
      }

      const existingProposal = await prisma.draft_proposals.findUnique({
        where: { id },
      });

      if (!existingProposal) {
        res.status(404).json({ error: "Draft proposal not found" });
        return;
      }

      const isVerified = verifySignature({
        message,
        signature,
        publicKey,
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
