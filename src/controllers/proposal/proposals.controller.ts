import { Request, Response } from "express";
import { prisma } from "../../index";

interface ProposalQueryParams {
  created_by?: string;
  page_size?: string;
  page?: string;
}

export class ProposalController {
  public getPendingProposals = async (
    req: Request<
      {},
      {},
      {},
      ProposalQueryParams
    >,
    res: Response
  ): Promise<void> => {
    try {
      const { created_by, page_size, page } = req.query;
      const pageSize = parseInt(page_size ?? "10");
      const pageNumber = parseInt(page ?? "1");

      const records = await prisma.proposal.findMany({
        where: { isApproved: false, isRejected: false, creatorId: created_by },
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
      });

      const count = await prisma.proposal.count({
        where: { isApproved: false, isRejected: false, creatorId: created_by },
      });

      res.status(200).json({ proposals: records, count });
    } catch (error) {
      console.error("Error fetching pending proposals:", error);
      res.status(500).json({ error: "Failed to fetch pending proposals" });
    }
  };
}
