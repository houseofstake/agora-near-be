import { Request, Response } from "express";
import { prisma } from "../index";

export class ProposalVotingHistoryController {
  public getProposalVotingHistory = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { proposal_id } = req.params;
      const { page_size, page } = req.query;
      const pageSize = parseInt(page_size as string);
      const pageNumber = parseInt(page as string);
      const proposalId = parseInt(proposal_id);

      const records = await prisma.proposalVotingHistory.findMany({
        where: { proposalId },
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
        orderBy: {
          votingPower: 'desc',
        },
      })

      const count = await prisma.proposalVotingHistory.count({
        where: { proposalId },
      })

      res.status(200).json({ records, count });
    } catch (error) {
      console.error("Error fetching proposal voting history:", error);
      res.status(500).json({ error: "Failed to fetch proposal voting history" });
    }
  };
}
