import { Request, Response } from "express";
import { prisma } from "../..";

interface ProposalParams {
  proposal_id: string;
}

interface PaginationQuery {
  page_size?: string;
  page?: string;
}

interface NonVoterRecord {
  id: number;
  proposal_id: number;
  registered_voter_id: string;
  current_voting_power: number | null;
}

export class ProposalVotingHistoryController {
  public getProposalVotingHistory = async (
    req: Request<ProposalParams, {}, {}, PaginationQuery>,
    res: Response
  ): Promise<void> => {
    try {
      const { proposal_id } = req.params;
      const { page_size, page } = req.query;
      const pageSize = parseInt(page_size ?? "10") || 10;
      const pageNumber = parseInt(page ?? "1") || 1;
      const proposalId = parseInt(proposal_id);

      const records = await prisma.proposalVotingHistory.findMany({
        where: { proposalId },
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
        orderBy: [
          { votingPower: "desc" },
          { voterId: "asc" },
        ],
      });

      const count = await prisma.proposalVotingHistory.count({
        where: { proposalId },
      });

      const voteRecords = records.map((record) => {
        const { votingPower, voterId, voteOption } = record;

        return {
          accountId: voterId,
          votingPower: votingPower?.toFixed() ?? "0",
          voteOption: voteOption?.toString(),
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
          votedAt: "asc",
        },
      });

      const voteRecords = records.map((record) => {
        const { votingPower, voterId, voteOption } = record;

        return {
          accountId: voterId,
          votingPower: votingPower?.toFixed() ?? "0",
          voteOption: voteOption?.toString(),
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

      const records = await prisma.$queryRaw<NonVoterRecord[]>`
        SELECT 
          pnv.id,
          pnv.proposal_id,
          pnv.registered_voter_id,
          rv.current_voting_power
        FROM fastnear.proposal_non_voters pnv
        LEFT JOIN fastnear.registered_voters rv ON pnv.registered_voter_id = rv.registered_voter_id
        WHERE pnv.proposal_id = ${proposalId}
        ORDER BY rv.current_voting_power DESC NULLS LAST, pnv.registered_voter_id ASC
        LIMIT ${pageSize} OFFSET ${(pageNumber - 1) * pageSize}
      `;

      const count = await prisma.proposalNonVoters.count({
        where: { proposalId },
      });

      const nonVotersWithVotingPower = records.map((record) => ({
        id: record.id,
        proposalId: record.proposal_id,
        registeredVoterId: record.registered_voter_id,
        votingPower: record.current_voting_power?.toFixed() ?? "0",
      }));

      res.status(200).json({ nonVoters: nonVotersWithVotingPower, count });
    } catch (error) {
      console.error("Error fetching proposal non voters:", error);
      res.status(500).json({ error: "Failed to fetch proposal non voters" });
    }
  };
}
