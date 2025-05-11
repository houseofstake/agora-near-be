import { Request, Response } from "express";
import { prisma } from "../../index";

interface ProposalVotingHistoryParams {
  proposal_id: string;
}

interface ProposalVotingHistoryQuery {
  page_size?: string;
  page?: string;
}

export class ProposalVotingHistoryController {
  public getProposalVotingHistory = async (
    req: Request<
      ProposalVotingHistoryParams,
      {},
      {},
      ProposalVotingHistoryQuery
    >,
    res: Response
  ): Promise<void> => {
    try {
      const { proposal_id } = req.params;
      const { page_size, page } = req.query;
      const pageSize = parseInt(page_size ?? "10");
      const pageNumber = parseInt(page ?? "1");
      const proposalId = parseInt(proposal_id);

      const records = await prisma.proposalVotingHistory.findMany({
        where: { proposalId },
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
        orderBy: {
          votingPower: "desc",
        },
      });

      const count = await prisma.proposalVotingHistory.count({
        where: { proposalId },
      });

      const voteRecords = records.map((record) => {
        const { votingPower, voterId, voteOption } = record;

        return {
          accountId: voterId,
          votingPower: votingPower.toString(),
          voteOption: voteOption.toString(),
        };
      });

      res.status(200).json({ votes: voteRecords, count });
    } catch (error) {
      console.error("Error fetching proposal voting history:", error);
      res
        .status(500)
        .json({ error: "Failed to fetch proposal voting history" });
    }
  };
}
