import { Request, Response } from "express";
import { prisma } from "../..";
import { proposal } from "../../generated/prisma";
import {
  convertMsToNanoSeconds,
  convertNanoSecondsToMs,
} from "../../lib/utils/time";

interface ActiveProposalQueryParams {
  page_size?: string;
  page?: string;
}

interface PendingProposalQueryParams {
  created_by?: string;
  page_size?: string;
  page?: string;
}

function getDerivedProposalStatus(proposal: proposal) {
  const startTimeMs = proposal.voting_start_at?.getTime();
  const votingDurationMs = convertNanoSecondsToMs(
    proposal.voting_duration_ns?.toFixed()
  );

  if (proposal.isRejected) {
    return "Rejected";
  }

  if (!proposal.isApproved) {
    return "Created";
  }

  if (proposal.isApproved && startTimeMs && votingDurationMs) {
    const endTimeMs = startTimeMs + votingDurationMs;
    const currentTimeMs = Date.now();
    if (currentTimeMs < endTimeMs) {
      return "Voting";
    } else {
      return "Finished";
    }
  }

  return "Unknown";
}

function mapRecordToResponse(record: proposal) {
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
    forVotingPower: record.forVotingPower.toFixed(),
    againstVotingPower: record.againstVotingPower.toFixed(),
    abstainVotingPower: record.abstainVotingPower.toFixed(),
    votingDurationNs: record.voting_duration_ns?.toFixed(),
    totalVotingPower: record.total_venear_at_approval?.toFixed(),
    status: getDerivedProposalStatus(record),
    votingStartTimeNs: record.voting_start_at
      ? convertMsToNanoSeconds(record.voting_start_at.getTime())
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
      const pageSize = parseInt(page_size ?? "10");
      const pageNumber = parseInt(page ?? "1");

      const records = await prisma.proposal.findMany({
        where: { isApproved: true, isRejected: false },
        orderBy: { createdAt: "desc" },
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
      });

      const count = await prisma.proposal.count({
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
      const pageSize = parseInt(page_size ?? "10");
      const pageNumber = parseInt(page ?? "1");

      const records = await prisma.proposal.findMany({
        where: { isApproved: false, isRejected: false, creatorId: created_by },
        orderBy: { createdAt: "desc" },
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
      });

      const count = await prisma.proposal.count({
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
}
