import { Request, Response } from "express";

import {
  verifySignedPayload,
  SignedPayload,
} from "../../lib/signature/verifySignature";
import { sanitizeContent } from "../../lib/utils/sanitizationUtils";
import {
  delegate_statements,
  delegationEvents,
  Prisma,
  registeredVoters,
} from "../../generated/prisma";
import type { InputJsonValue } from "../../generated/prisma/runtime/library";
import { providers } from "near-api-js";
import { getRpcUrl } from "../../lib/utils/rpc";
import Big from "big.js";
import { prisma } from "../..";
import {
  NotificationPreferences,
  NotificationPreferencesInput,
  isValidNotificationPreference,
} from "../../lib/utils/notificationTypes";

type DelegateStatementData = {
  address: string;
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
  notification_preferences?: NotificationPreferencesInput;
};

type DelegateStatementInput = SignedPayload<DelegateStatementData>;

interface DeletesQuery {
  page_size?: string;
  page?: string;
  order_by?: string;
  filter_by?: string;
  issue_type?: string;
  sorting_seed?: string;
}

type DelegateWithVoterInfo = delegate_statements &
  registeredVoters & {
    notificationPreferences?: NotificationPreferences | null;
  };

interface AddressParams {
  address: string;
}

interface PaginationQuery {
  page_size?: string;
  page?: string;
}

interface HOSActivityQuery extends PaginationQuery {
  network_id: string;
  contract_id: string;
}

function mapDelegationEvent(record: delegationEvents) {
  return {
    ...record,
    blockHeight: record.blockHeight?.toString(),
  };
}

export class DelegatesController {
  public getAllDelegates = async (
    req: Request<{}, {}, {}, DeletesQuery>,
    res: Response
  ): Promise<void> => {
    const { page_size, page, order_by, filter_by, sorting_seed, issue_type } =
      req.query;
    const pageSize = parseInt(page_size ?? "10");
    const pageNumber = parseInt(page ?? "1");
    const seed = sorting_seed ? parseFloat(sorting_seed) : Math.random();

    let orderByClause;
    if (order_by === "most_voting_power") {
      orderByClause = Prisma.sql`ORDER BY rv.current_voting_power DESC NULLS LAST`;
    } else if (order_by === "least_voting_power") {
      orderByClause = Prisma.sql`ORDER BY rv.current_voting_power ASC NULLS FIRST`;
    } else {
      orderByClause = Prisma.sql`ORDER BY -log(random()) / NULLIF(rv.current_voting_power, 0) NULLS LAST`;
    }

    let filterByClause = Prisma.sql``;
    const conditions: Prisma.Sql[] = [];

    if (filter_by === "endorsed") {
      conditions.push(Prisma.sql`ds.endorsed = true`);
    }

    if (issue_type) {
      const issueTypes = issue_type.split(",").map((type) => type.trim());
      conditions.push(Prisma.sql`EXISTS (
        SELECT 1 FROM jsonb_array_elements(
          CASE 
            WHEN jsonb_typeof(ds."topIssues") = 'array' THEN ds."topIssues"
            ELSE '[]'::jsonb
          END
        ) AS issue
        WHERE issue->>'type' = ANY(${issueTypes})
      )`);
    }

    if (conditions.length > 0) {
      filterByClause = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
    }

    const { records, countResult } = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw(Prisma.sql`SELECT setseed(${seed});`);

        const [records, countResult] = await Promise.all([
          tx.$queryRaw<DelegateWithVoterInfo[]>(
            Prisma.sql`
            SELECT
              rv.registered_voter_id as "registeredVoterId",
              rv.current_voting_power as "currentVotingPower",
              rv.proposal_participation_rate as "proposalParticipationRate",
              COALESCE(rv.registered_voter_id, ds.address) as address,
              ds.twitter,
              ds.discord,
              ds.email,
              ds.warpcast,
              ds.statement,
              ds."topIssues",
              ds.endorsed,
              ds.notification_preferences as "notificationPreferences"
            FROM fastnear.registered_voters rv
            FULL OUTER JOIN web2.delegate_statements ds ON rv.registered_voter_id = ds.address
            ${filterByClause}
            ${orderByClause}
            LIMIT ${pageSize}
            OFFSET ${(pageNumber - 1) * pageSize}
          `
          ),
          tx.$queryRaw<{ count: bigint }[]>(
            Prisma.sql`
            SELECT COUNT(*) as count
            FROM fastnear.registered_voters rv
            FULL OUTER JOIN web2.delegate_statements ds ON rv.registered_voter_id = ds.address
            ${filterByClause}
          `
          ),
        ]);

        return { records, countResult };
      },
      { timeout: 10000 } // TODO(jcarnide): Revert this once we figure out the root cause of query slowness
    );

    const delegates = records.map((record) => {
      const {
        registeredVoterId,
        currentVotingPower,
        proposalParticipationRate,
        address,
        twitter,
        discord,
        email,
        warpcast,
        statement,
        topIssues,
        endorsed,
        notificationPreferences,
      } = record;

      return {
        address,
        votingPower: currentVotingPower?.toFixed(),
        participationRate: proposalParticipationRate?.toFixed(),
        twitter,
        discord,
        email,
        warpcast,
        statement,
        topIssues,
        endorsed,
        notificationPreferences,
      };
    });

    const countArray = countResult as { count: bigint }[];
    const count = Number(countArray[0].count);

    res.status(200).json({ delegates, count });
  };

  public getDelegateByAddress = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { address } = req.params;
      const { networkId } = req.query;

      const voterData = await prisma.$queryRaw<DelegateWithVoterInfo[]>(
        Prisma.sql`
          SELECT
            rv.registered_voter_id as "registeredVoterId",
            rv.current_voting_power as "currentVotingPower",
            rv.proposal_participation_rate as "proposalParticipationRate",
            COALESCE(rv.registered_voter_id, ds.address) as address,
            ds.twitter,
            ds.discord,
            ds.email,
            ds.warpcast,
            ds.statement,
            ds."topIssues",
            ds.message,
            ds.signature,
            ds."publicKey",
            ds."agreeCodeConduct",
            ds.endorsed,
            ds.notification_preferences as "notificationPreferences"
          FROM fastnear.registered_voters rv
          FULL OUTER JOIN web2.delegate_statements ds ON rv.registered_voter_id = ds.address
          WHERE COALESCE(rv.registered_voter_id, ds.address) = ${address}
        `
      );

      if (!voterData || voterData.length === 0) {
        // Not found in registered voters, check if it's a valid NEAR account
        try {
          const rpcUrl = getRpcUrl({
            networkId,
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

      const [forCount, againstCount, abstainCount, delegatedFromCount] =
        await Promise.all([
          forCountPromise,
          againstCountPromise,
          abstainCountPromise,
          delegatedFromCountPromise,
        ]);

      res.status(200).json({
        delegate: {
          address: data.address ?? data.registeredVoterId,
          twitter: data.twitter,
          discord: data.discord,
          email: data.email,
          warpcast: data.warpcast,
          statement: data.statement,
          topIssues: data.topIssues,
          endorsed: data.endorsed,
          notificationPreferences: data.notificationPreferences,
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
        voteOption: record.voteOption?.toString(),
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

      res.status(200).json({
        events: records.map(mapDelegationEvent),
        count,
      });
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

      res.status(200).json({
        events: records.map(mapDelegationEvent),
        count,
      });
    } catch (error) {
      console.error("Error fetching delegate delegated to events:", error);
      res
        .status(500)
        .json({ error: "Failed to fetch delegate delegated to events" });
    }
  };

  public getDelegateHosActivity = async (
    req: Request<AddressParams, {}, {}, HOSActivityQuery>,
    res: Response
  ): Promise<void> => {
    try {
      const { address } = req.params;
      const { page_size, page, network_id, contract_id } = req.query;
      const pageSize = parseInt(page_size ?? "10");
      const pageNumber = parseInt(page ?? "1");

      const url = getRpcUrl({ networkId: network_id });
      const provider = new providers.JsonRpcProvider({ url: url });

      // Query the veNEAR contract to get the storage deposit
      const configResult = await provider.query({
        request_type: "call_function",
        account_id: contract_id,
        method_name: "get_config",
        args_base64: "",
        finality: "final",
      });
      const resultArray = (configResult as any).result;
      const jsonResult = JSON.parse(Buffer.from(resultArray).toString()) as {
        local_deposit: string;
      };

      const storageDeposit = jsonResult?.local_deposit ?? "0";

      const whereCondition = {
        accountId: address,
        OR: [
          {
            methodName: "on_lockup_update",
            eventType: "on_lockup_update_ft_burn",
          },
          {
            methodName: "on_lockup_update",
            eventType: "on_lockup_update_ft_mint",
          },
          {
            methodName: "delegate_all",
            eventType: "delegate_all_ft_burn",
          },
          {
            methodName: "on_lockup_deployed",
            eventType: "lockup_deployed",
          },
          {
            methodName: "delegate_all",
            eventType: "delegate_all_ft_mint",
          },
        ],
      };

      const records = await prisma.userActivities.findMany({
        where: whereCondition,
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
        orderBy: {
          eventTimestamp: "desc",
        },
      });

      const count = await prisma.userActivities.count({
        where: whereCondition,
      });

      const getTransactionType = (
        methodName: string,
        eventType: string
      ): string => {
        if (
          methodName === "on_lockup_update" &&
          eventType === "on_lockup_update_ft_burn"
        ) {
          return "unlock";
        }
        if (
          methodName === "on_lockup_update" &&
          eventType === "on_lockup_update_ft_mint"
        ) {
          return "lock";
        }
        if (
          methodName === "delegate_all" &&
          eventType === "delegate_all_ft_burn"
        ) {
          return "outbound_delegation";
        }
        if (
          methodName === "on_lockup_deployed" &&
          eventType === "lockup_deployed"
        ) {
          return "initial_registration";
        }
        if (
          methodName === "delegate_all" &&
          eventType === "delegate_all_ft_mint"
        ) {
          return "inbound_delegation";
        }
        return "unknown";
      };

      const hosActivity = records.map((record) => {
        const transactionType = getTransactionType(
          record.methodName ?? "",
          record.eventType ?? ""
        );

        // The amount logged by the contract does not include the storage deposit so we add it to the locked balance
        const lockedBalanceWithStorage = record.lockedNearBalance
          ? Big(storageDeposit).plus(Big(record.lockedNearBalance.toFixed()))
          : null;

        const lockedNearBalance =
          transactionType === "initial_registration"
            ? storageDeposit // Initial locked balance is the storage deposit
            : lockedBalanceWithStorage?.toFixed() ?? null;

        const nearAmount =
          transactionType === "initial_registration"
            ? storageDeposit // Initial voting power is the storage deposit
            : record.nearAmount?.toFixed() ?? null;

        return {
          receiptId: record.receiptId,
          blockHeight: record.blockHeight?.toString(),
          eventDate: record.eventDate,
          nearAmount,
          lockedNearBalance,
          transactionType,
        };
      });

      res.status(200).json({ hosActivity, count });
    } catch (error) {
      console.error("Error fetching delegate HOS activity:", error);
      res.status(500).json({ error: "Failed to fetch delegate HOS activity" });
    }
  };

  public createDelegateStatement = async (
    req: Request<{}, {}, DelegateStatementInput, { network_id: string }>,
    res: Response
  ): Promise<void> => {
    try {
      const { signature, publicKey, data, message } = req.body;

      const networkId = req.query.network_id || "mainnet";

      const isVerified = await verifySignedPayload({
        signedPayload: { signature, publicKey, message, data },
        networkId,
        accountId: data.address,
      });

      if (!isVerified) {
        res.status(400).json({ error: "Invalid signature" });
        return;
      }

      // Validate notification preferences if provided
      let notificationPreferencesData: Record<string, unknown> | undefined;
      if (data.notification_preferences) {
        const invalidPrefs = Object.entries(
          data.notification_preferences
        ).filter(([, value]) => !isValidNotificationPreference(value));
        if (invalidPrefs.length > 0) {
          console.warn("Invalid notification preferences for account", {
            address: data.address,
            networkId,
            publicKey,
            invalidPrefs,
          });
          res.status(400).json({
            error: `Invalid notification preference values. Must be 'true', 'false', or 'prompt'`,
          });
          return;
        }
        const currentPrefs = await prisma.delegate_statements.findUnique({
          where: { address: data.address },
          select: { notification_preferences: true },
        });

        notificationPreferencesData = {
          ...((currentPrefs?.notification_preferences as object) || {}),
          ...data.notification_preferences,
          last_updated: new Date().toISOString(),
        };
      }

      const delegateData = {
        address: data.address,
        message,
        signature,
        statement: sanitizeContent(data.statement),
        twitter: data.twitter,
        warpcast: data.warpcast,
        discord: data.discord,
        email: data.email,
        topIssues: data.topIssues,
        agreeCodeConduct: data.agreeCodeConduct,
        publicKey,
        ...(notificationPreferencesData && {
          notification_preferences:
            notificationPreferencesData as InputJsonValue,
        }),
      };

      const createdDelegateStatement = await prisma.delegate_statements.upsert({
        where: { address: data.address },
        update: delegateData,
        create: delegateData,
      });

      res
        .status(200)
        .json({ delegateStatement: createdDelegateStatement, success: true });
    } catch (error) {
      console.error("Unexpected error creating delegate statement:", {
        error,
        address: req.body.data.address,
        networkId: req.query.network_id,
        publicKey: req.body.publicKey,
      });
      res.status(500).json({ error: "Failed to create delegate statement" });
    }
  };
}
