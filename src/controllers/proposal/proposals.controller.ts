import { Request, Response } from "express";
import { prisma } from "../..";

import { convertMsToNanoSeconds } from "../../lib/utils/time";
import { getDerivedProposalStatus } from "../../lib/utils/proposal";
import { proposals } from "../../generated/prisma";

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
}
