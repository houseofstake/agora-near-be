import { Request, Response } from "express";
import { prisma } from "../../index";

interface ProposalParams {
  proposal_id: string;
}

interface PaginationQuery {
  page_size?: string;
  page?: string;
}

export class ProposalVotingHistoryController {
  public getProposalVotingHistory = async (
    req: Request<
      ProposalParams,
      {},
      {},
      PaginationQuery
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
          votingPower: votingPower?.toFixed() ?? "0",
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

  public getProposalVotingChartsData = async (
    req: Request<ProposalParams, {}, {}, {}>,
    res: Response
  ): Promise<void> => {
    try {
      const { proposal_id } = req.params;
      const proposalId = parseInt(proposal_id);

      const records = await prisma.proposalVotingHistory.findMany({
        where: { proposalId },
        orderBy: {
          votingPower: "desc",
        },
      });

      const voteRecords = records.map((record) => {
        const { votingPower, voterId, voteOption } = record;

        return {
          accountId: voterId,
          votingPower: votingPower?.toFixed() ?? "0",
          voteOption: voteOption.toString(),
          votedAt: record.votedAt,
        };
      });

      res.status(200).json({ data: voteRecords });
    } catch (error) {
      console.error("Error fetching proposal voting charts data:", error);
      res
        .status(500)
        .json({ error: "Failed to fetch proposal voting charts data" });
    }
  };

  public getProposalNonVoters = async (
    req: Request<ProposalParams, {}, {}, PaginationQuery>,
    res: Response
  ): Promise<void> => {
    try {
      const { proposal_id } = req.params;
      const { page_size, page } = req.query;
      const pageSize = parseInt(page_size ?? "10");
      const pageNumber = parseInt(page ?? "1");
      const proposalId = parseInt(proposal_id);

      const records = await prisma.proposalNonVoters.findMany({
        where: { proposalId },
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
      });

      const count = await prisma.proposalNonVoters.count({
        where: { proposalId },
      });

      res.status(200).json({ nonVoters: records, count });
    } catch (error) {
      console.error("Error fetching proposal non voters:", error);
      res
        .status(500)
        .json({ error: "Failed to fetch proposal non voters" });
    }
  }
}
