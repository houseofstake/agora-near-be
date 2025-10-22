import { Request, Response } from "express";
import { prisma } from "../..";
import Big from "big.js";

import { convertMsToNanoSeconds } from "../../lib/utils/time";
import { getDerivedProposalStatus } from "../../lib/utils/proposal";
import { proposals } from "../../generated/prisma";

const QUORUM_FLOOR_YOCTONEAR = "7000000000000000000000000000000000000"; // 7M veNEAR
const DEFAULT_QUORUM_PERCENTAGE = "0.35";

interface ActiveProposalQueryParams {
  page_size?: string;
  page?: string;
}

interface PendingProposalQueryParams {
  created_by?: string;
  page_size?: string;
  page?: string;
}

function mapRecordToResponse(record: proposals) {
  return {
    id: record.id,
    approvedAt: record.approvedAt,
    approverId: record.approverId,
    createdAt: record.createdAt,
    creatorId: record.creatorId,
    hasVote: record.hasVotes,
    isApproved: record.isApproved,
    isRejected: record.isRejected,
    proposalDescription: record.proposalDescription,
    proposalId: record.proposalId,
    proposalTitle: record.proposalTitle,
    proposalUrl: record.proposalUrl,
    receiptId: record.receiptId,
    rejectedAt: record.rejectedAt,
    rejecterId: record.rejecterId,
    forVotingPower: record.forVotingPower?.toFixed(),
    againstVotingPower: record.againstVotingPower?.toFixed(),
    abstainVotingPower: record.abstainVotingPower?.toFixed(),
    votingDurationNs: record.votingDurationNs?.toFixed(),
    totalVotingPower: record.totalVenearAtApproval?.toFixed(),
    status: getDerivedProposalStatus(record),
    votingStartTimeNs: record.votingStartAt
      ? convertMsToNanoSeconds(record.votingStartAt.getTime())
      : null,
    votingCreatedAtNs: record.createdAt
      ? convertMsToNanoSeconds(record.createdAt.getTime())
      : null,
  };
}

export class ProposalController {
  public getApprovedProposals = async (
    req: Request<{}, {}, {}, ActiveProposalQueryParams>,
    res: Response
  ): Promise<void> => {
    try {
      const { page_size, page } = req.query;
      const pageSize = parseInt(page_size ?? "10") || 10;
      const pageNumber = parseInt(page ?? "1") || 1;

      const records = await prisma.proposals.findMany({
        where: { isApproved: true, isRejected: false },
        orderBy: { createdAt: "desc" },
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
      });

      const count = await prisma.proposals.count({
        where: { isApproved: true, isRejected: false },
      });

      res.status(200).json({
        proposals: records.map((record) => mapRecordToResponse(record)),
        count,
      });
    } catch (error) {
      console.error("Error fetching approved proposals:", error);
      res.status(500).json({ error: "Failed to fetch approved proposals" });
    }
  };

  public getPendingProposals = async (
    req: Request<{}, {}, {}, PendingProposalQueryParams>,
    res: Response
  ): Promise<void> => {
    try {
      const { created_by, page_size, page } = req.query;
      const pageSize = parseInt(page_size ?? "10") || 10;
      const pageNumber = parseInt(page ?? "1") || 1;

      const records = await prisma.proposals.findMany({
        where: { isApproved: false, isRejected: false, creatorId: created_by },
        orderBy: { createdAt: "desc" },
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
      });

      const count = await prisma.proposals.count({
        where: { isApproved: false, isRejected: false, creatorId: created_by },
      });

      res.status(200).json({
        proposals: records.map((record) => mapRecordToResponse(record)),
        count,
      });
    } catch (error) {
      console.error("Error fetching pending proposals:", error);
      res.status(500).json({ error: "Failed to fetch pending proposals" });
    }
  };

  public getProposalQuorum = async (
    req: Request<{ proposal_id: string }>,
    res: Response
  ): Promise<void> => {
    try {
      const proposalId = req.params.proposal_id;

      // Query the proposal
      const proposal = await prisma.proposals.findFirst({
        where: {
          proposalId: proposalId,
        },
      });

      if (!proposal) {
        console.warn(`Proposal with id ${proposalId} not found`);
        res.status(404).json({ error: "Proposal not found" });
        return;
      }

      if (!proposal.isApproved) {
        console.warn(`Proposal with id ${proposalId} is not approved`);
        res.status(400).json({ error: "Proposal is not approved" });
        return;
      }

      // Query for quorum overrides
      const overrides = proposal.proposalId
        ? await prisma.quorum_overrides.findMany({
            where: {
              startingFromId: {
                lte: proposal.proposalId,
              },
            },
            orderBy: {
              startingFromId: "desc",
            },
            take: 1,
          })
        : [];

      let quorumAmount: string;

      if (overrides.length > 0) {
        const override = overrides[0];
        const totalVenear = proposal.totalVenearAtApproval
          ? new Big(proposal.totalVenearAtApproval.toFixed())
          : new Big(0);

        if (override.overrideType === "fixed") {
          quorumAmount = override.overrideValue;
        } else if (override.overrideType === "percentage") {
          const overrideValue = new Big(override.overrideValue);
          quorumAmount = overrideValue.mul(totalVenear).toFixed(0);
        } else {
          console.error(
            "Invalid override entry in database",
            JSON.stringify(override, null, 2)
          );
          res.status(500).json({ error: "Failed to fetch proposal quorum" });
          return;
        }
      } else {
        // Default calculation: max(QUORUM_FLOOR_YOCTONEAR, DEFAULT_QUORUM_PERCENTAGE * totalVenearAtApproval)
        const quorumFloor = new Big(QUORUM_FLOOR_YOCTONEAR);
        const totalVenear = proposal.totalVenearAtApproval
          ? new Big(proposal.totalVenearAtApproval.toFixed())
          : new Big(0);
        const percentageBasedQuorum = new Big(DEFAULT_QUORUM_PERCENTAGE).mul(
          totalVenear
        );
        quorumAmount = percentageBasedQuorum.gt(quorumFloor)
          ? percentageBasedQuorum.toFixed(0)
          : quorumFloor.toFixed(0);
      }

      res.status(200).json({ quorumAmount });
    } catch (error) {
      console.error("Error fetching proposal quorum:", error);
      res.status(500).json({ error: "Failed to fetch proposal quorum" });
    }
  };
}
