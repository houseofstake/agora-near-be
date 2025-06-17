import { Request, Response } from "express";
import { prisma } from "../../index";
import { verifySignature } from "../../lib/signature/verifySignature";
import { sanitizeContent } from "../../lib/utils/sanitizationUtils";
import {
  delegate_statements,
  Prisma,
  registeredVoters,
} from "../../generated/prisma";
import { providers } from "near-api-js";
import { getRpcUrl } from "../../lib/utils/rpc";

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
  order_by?: string;
}

type DelegateWithVoterInfo = delegate_statements & registeredVoters;

interface AddressParams {
  address: string;
}

interface PaginationQuery {
  page_size?: string;
  page?: string;
}

export class DelegatesController {
  public getAllDelegates = async (
    req: Request<{}, {}, {}, DeletesQuery>,
    res: Response
  ): Promise<void> => {
    const { page_size, page, order_by } = req.query;
    const pageSize = parseInt(page_size ?? "10");
    const pageNumber = parseInt(page ?? "1");

    let orderByClause;
    if (order_by === "most_voting_power") {
      orderByClause = Prisma.sql`ORDER BY rv.current_voting_power DESC NULLS LAST`;
    } else if (order_by === "least_voting_power") {
      orderByClause = Prisma.sql`ORDER BY rv.current_voting_power ASC NULLS FIRST`;
    } else {
      orderByClause = Prisma.sql`ORDER BY -log(random()) / NULLIF(rv.current_voting_power, 0)`;
    }

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
      ${orderByClause}
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
      const { networkId } = req.query;

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
        // Not found in registered voters, check if it's a valid NEAR account
        try {
          const isValidNetworkId =
            networkId &&
            typeof networkId === "string" &&
            (networkId === "mainnet" || networkId === "testnet");

          const rpcUrl = getRpcUrl({
            networkId: isValidNetworkId ? networkId : "mainnet",
            useArchivalNode: true,
          });

          const provider = new providers.JsonRpcProvider({ url: rpcUrl });

          // Query account state to verify it exists
          await provider.query({
            request_type: "view_account",
            account_id: address,
            finality: "final",
          });

          // If we reach here, the account exists
          res.status(200).json({
            delegate: {
              address: address,
            },
          });
          return;
        } catch {
          // Account doesn't exist or other NEAR error
          res.status(404).json({
            message:
              "Address not found in registered voters and is not a valid NEAR account",
          });
          return;
        }
      }

      const data = voterData[0];

      const forCountPromise = prisma.proposalVotingHistory.count({
        where: { voterId: address, voteOption: 0 },
      });

      const againstCountPromise = prisma.proposalVotingHistory.count({
        where: { voterId: address, voteOption: 1 },
      });

      const abstainCountPromise = prisma.proposalVotingHistory.count({
        where: { voterId: address, voteOption: 2 },
      });

      const delegatedFromCountPromise = prisma.delegationEvents.count({
        where: {
          delegateeId: address,
          isLatestDelegatorEvent: true,
          delegateMethod: "delegate_all",
          delegateEvent: "ft_mint",
        },
      });

      const [forCount, againstCount, abstainCount, delegatedFromCount] = await Promise.all([
        forCountPromise,
        againstCountPromise,
        abstainCountPromise,
        delegatedFromCountPromise,
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
          abstainCount,
          delegatedFromCount,
          participationRate: data.proposalParticipationRate?.toFixed(),
        },
      });
    } catch (error) {
      console.error("Error fetching delegate:", error);
      res.status(500).json({ error: "Failed to fetch delegate" });
    }
  };

  public getDelegateVotingHistory = async (
    req: Request<AddressParams, {}, {}, PaginationQuery>,
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

  public getDelegateDelegatedFrom = async (
    req: Request<AddressParams, {}, {}, PaginationQuery>,
    res: Response
  ): Promise<void> => {
    try {
      const { address } = req.params;
      const { page_size, page } = req.query;
      const pageSize = parseInt(page_size ?? "10");
      const pageNumber = parseInt(page ?? "1");

      const records = await prisma.delegationEvents.findMany({
        where: {
          delegateeId: address,
          isLatestDelegatorEvent: true,
          delegateEvent: "ft_mint",
        },
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
        orderBy: {
          eventTimestamp: "desc",
        },
      });

      const count = await prisma.delegationEvents.count({
        where: {
          delegateeId: address,
          isLatestDelegatorEvent: true,
          delegateEvent: "ft_mint",
        },
      });

      res.status(200).json({ events: records, count });
    } catch (error) {
      console.error("Error fetching delegate delegated from events:", error);
      res
        .status(500)
        .json({ error: "Failed to fetch delegate delegated from events" });
    }
  };

  public getDelegateDelegatedTo = async (
    req: Request<AddressParams, {}, {}, PaginationQuery>,
    res: Response
  ): Promise<void> => {
    try {
      const { address } = req.params;
      const { page_size, page } = req.query;
      const pageSize = parseInt(page_size ?? "10");
      const pageNumber = parseInt(page ?? "1");

      const records = await prisma.delegationEvents.findMany({
        where: {
          delegatorId: address,
          isLatestDelegatorEvent: true,
          delegateMethod: "delegate_all",
          delegateEvent: "ft_mint",
        },
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
        orderBy: {
          eventTimestamp: "desc",
        },
      });

      const count = await prisma.delegationEvents.count({
        where: {
          delegatorId: address,
          isLatestDelegatorEvent: true,
          delegateMethod: "delegate_all",
          delegateEvent: "ft_mint",
        },
      });

      res.status(200).json({ events: records, count });
    } catch (error) {
      console.error("Error fetching delegate delegated to events:", error);
      res
        .status(500)
        .json({ error: "Failed to fetch delegate delegated to events" });
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
