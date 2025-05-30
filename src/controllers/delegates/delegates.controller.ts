import { Request, Response } from "express";
import { prisma } from "../../index";
import { verifySignature } from "../../lib/signature/verifySignature";
import { sanitizeContent } from "../../lib/utils/sanitizationUtils";
import { delegate_statements, registeredVoters } from "../../generated/prisma";

type DelegateStatementInput = {
  address: string;
  message: string;
  signature: string;
  publicKey: string;
  twitter: string;
  discord: string;
  email: string;
  warpcast: string;
  topIssues: {
    type: string;
    value: string;
  }[];
  agreeCodeConduct: boolean;
  statement: string;
};

interface DeletesQuery {
  page_size?: string;
  page?: string;
}

type DelegateWithVoterInfo = delegate_statements & registeredVoters;

interface DelegateVotingHistoryParams {
  address: string;
}

interface DelegateVotingHistoryQuery {
  page_size?: string;
  page?: string;
}

export class DelegatesController {
  public getAllDelegates = async (
    req: Request<{}, {}, {}, DeletesQuery>,
    res: Response
  ): Promise<void> => {
    const { page_size, page } = req.query;
    const pageSize = parseInt(page_size ?? "10");
    const pageNumber = parseInt(page ?? "1");

    const records = await prisma.$queryRaw<DelegateWithVoterInfo[]>`
      SELECT
        rv.registered_voter_id as "registeredVoterId",
        rv.current_voting_power as "currentVotingPower",
        rv.proposal_participation_rate as "proposalParticipationRate",
        ds.address,
        ds.twitter,
        ds.discord,
        ds.email,
        ds.warpcast,
        ds.statement,
        ds."topIssues"
      FROM registered_voters rv
      LEFT JOIN delegate_statements ds ON rv.registered_voter_id = ds.address
      ORDER BY rv.current_voting_power DESC
      LIMIT ${pageSize}
      OFFSET ${(pageNumber - 1) * pageSize}
    `;

    const delegates = records.map((record) => {
      const {
        registeredVoterId,
        currentVotingPower,
        proposalParticipationRate,
        twitter,
        discord,
        email,
        warpcast,
        statement,
        topIssues,
      } = record;

      return {
        address: registeredVoterId,
        votingPower: currentVotingPower?.toFixed(),
        participationRate: proposalParticipationRate?.toFixed(),
        twitter,
        discord,
        email,
        warpcast,
        statement,
        topIssues,
      };
    });

    const count = await prisma.registeredVoters.count();

    res.status(200).json({ delegates, count });
  };

  public getDelegateByAddress = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { address } = req.params;

      const voterData = await prisma.$queryRaw<DelegateWithVoterInfo[]>`
        SELECT
          rv.registered_voter_id as "registeredVoterId",
          rv.current_voting_power as "currentVotingPower",
          rv.proposal_participation_rate as "proposalParticipationRate",
          ds.address,
          ds.twitter,
          ds.discord,
          ds.email,
          ds.warpcast,
          ds.statement,
          ds."topIssues",
          ds.message,
          ds.signature,
          ds."publicKey",
          ds."agreeCodeConduct"
        FROM registered_voters rv
        LEFT JOIN delegate_statements ds ON rv.registered_voter_id = ds.address
        WHERE rv.registered_voter_id = ${address}
      `;

      if (!voterData || voterData.length === 0) {
        res.status(404).json({
          message: "Address not found in registered voters",
        });
        return;
      }

      const data = voterData[0];

      const forCountPromise = prisma.proposalVotingHistory.count({
        where: { voterId: address, voteOption: 0 },
      });

      const againstCountPromise = prisma.proposalVotingHistory.count({
        where: { voterId: address, voteOption: 1 },
      });

      const [forCount, againstCount] = await Promise.all([
        forCountPromise,
        againstCountPromise,
      ]);

      res.status(200).json({
        delegate: {
          address: data.registeredVoterId,
          twitter: data.twitter,
          discord: data.discord,
          email: data.email,
          warpcast: data.warpcast,
          statement: data.statement,
          topIssues: data.topIssues,
          votingPower: data.currentVotingPower?.toFixed(),
          forCount,
          againstCount,
          participationRate: data.proposalParticipationRate?.toFixed(),
        },
      });
    } catch (error) {
      console.error("Error fetching delegate:", error);
      res.status(500).json({ error: "Failed to fetch delegate" });
    }
  };

  public getDelegateVotingHistory = async (
    req: Request<
      DelegateVotingHistoryParams,
      {},
      {},
      DelegateVotingHistoryQuery
    >,
    res: Response
  ): Promise<void> => {
    try {
      const { address } = req.params;
      const { page_size, page } = req.query;
      const pageSize = parseInt(page_size ?? "10");
      const pageNumber = parseInt(page ?? "1");

      const records = await prisma.proposalVotingHistory.findMany({
        where: { voterId: address },
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
        orderBy: {
          votedDate: "desc",
        },
      });

      const count = await prisma.proposalVotingHistory.count({
        where: { voterId: address },
      });

      const votes = records.map((record) => ({
        voteOption: record.voteOption.toString(),
        votingPower: record.votingPower?.toFixed() ?? "0",
        address: record.voterId,
        votedAt: record.votedAt,
        proposalId: record.proposalId?.toString(),
        proposalName: record.proposalName,
      }));

      res.status(200).json({ votes, count });
    } catch (error) {
      console.error("Error fetching delegate voting history:", error);
      res
        .status(500)
        .json({ error: "Failed to fetch delegate voting history" });
    }
  };

  public createDelegateStatement = async (
    req: Request<{}, {}, DelegateStatementInput>,
    res: Response
  ): Promise<void> => {
    try {
      const {
        address,
        signature,
        publicKey,
        twitter,
        discord,
        email,
        warpcast,
        message,
        statement,
        topIssues,
        agreeCodeConduct,
      } = req.body;

      const isVerified = verifySignature({
        message,
        signature,
        publicKey,
      });

      if (!isVerified) {
        res.status(400).json({ error: "Invalid signature" });
        return;
      }

      const data = {
        address,
        message,
        signature,
        statement: sanitizeContent(statement),
        twitter,
        warpcast,
        discord,
        email,
        topIssues,
        agreeCodeConduct,
        publicKey,
      };

      const createdDelegateStatement = await prisma.delegate_statements.upsert({
        where: { address },
        update: data,
        create: data,
      });

      res
        .status(200)
        .json({ delegateStatement: createdDelegateStatement, success: true });
    } catch (error) {
      console.error("Error creating delegate statement:", error);
      res.status(500).json({ error: "Failed to create delegate statement" });
    }
  };
}
