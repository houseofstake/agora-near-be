import { Request, Response } from "express";
import { Prisma } from "../../generated/prisma";
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

interface VoteChangeRecord {
  voter_id: string;
  vote_option: number;
  voting_power: string;
  voted_at: Date;
  block_height: bigint;
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

  /**
   * GET /api/proposal/:proposal_id/vote-changes
   * Returns voters who changed their vote on a proposal, with their full vote history.
   */
  public getVoteChanges = async (
    req: Request<ProposalParams>,
    res: Response
  ): Promise<void> => {
    try {
      const { proposal_id } = req.params;
      const proposalId = parseInt(proposal_id);

      // Query all vote records for the proposal (not just the latest),
      // filtering to only voters who voted more than once
      const records = await prisma.$queryRaw<VoteChangeRecord[]>(
        Prisma.sql`
          WITH all_votes AS (
            SELECT
              ra.predecessor_id AS voter_id,
              CASE
                WHEN (safe_json_parse(convert_from(decode(ra.args_base64, 'base64'), 'UTF8')) ->> 'error') IS NULL
                THEN (safe_json_parse(convert_from(decode(ra.args_base64, 'base64'), 'UTF8')) ->> 'vote')::numeric
                ELSE NULL
              END AS vote_option,
              CASE
                WHEN (safe_json_parse(REPLACE(eo.logs[1], 'EVENT_JSON:', '')) ->> 'error') IS NULL
                THEN (safe_json_parse(REPLACE(eo.logs[1], 'EVENT_JSON:', '')) -> 'data' -> 0 ->> 'account_balance')
                ELSE '0'
              END AS voting_power,
              ra.block_timestamp AS voted_at,
              ra.block_height
            FROM fastnear.receipt_actions ra
            JOIN fastnear.execution_outcomes eo
              ON ra.receipt_id = eo.receipt_id
              AND eo.status = 'SuccessValue'
            WHERE ra.method_name = 'vote'
              AND ra.action_kind = 'FunctionCall'
              AND ra.receiver_id = (SELECT hos_contract_address FROM fastnear.proposals WHERE proposal_id = ${proposalId} LIMIT 1)
              AND CASE
                WHEN (safe_json_parse(convert_from(decode(ra.args_base64, 'base64'), 'UTF8')) ->> 'error') IS NULL
                THEN (safe_json_parse(convert_from(decode(ra.args_base64, 'base64'), 'UTF8')) ->> 'proposal_id')::numeric
                ELSE NULL
              END = ${proposalId}
          ),
          voters_with_changes AS (
            SELECT voter_id
            FROM all_votes
            GROUP BY voter_id
            HAVING COUNT(*) > 1
          )
          SELECT
            av.voter_id,
            av.vote_option,
            av.voting_power,
            av.voted_at,
            av.block_height
          FROM all_votes av
          INNER JOIN voters_with_changes vc ON av.voter_id = vc.voter_id
          ORDER BY av.voter_id, av.voted_at ASC
        `
      );

      // Group records by voter
      const voterMap = new Map<
        string,
        { vote_option: number; voting_power: string; voted_at: Date; block_height: number }[]
      >();

      for (const record of records) {
        const changes = voterMap.get(record.voter_id) || [];
        changes.push({
          vote_option: Number(record.vote_option),
          voting_power: record.voting_power ?? "0",
          voted_at: record.voted_at,
          block_height: Number(record.block_height),
        });
        voterMap.set(record.voter_id, changes);
      }

      const voteChanges = Array.from(voterMap.entries()).map(
        ([accountId, changes]) => ({
          account_id: accountId,
          changes,
        })
      );

      res.status(200).json({ vote_changes: voteChanges });
    } catch (error) {
      console.error("Error fetching vote changes:", error);
      res.status(500).json({ error: "Failed to fetch vote changes" });
    }
  };
}

