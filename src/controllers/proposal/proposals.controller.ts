import { Request, Response } from "express";
import { prisma } from "../..";

import { convertMsToNanoSeconds } from "../../lib/utils/time";
import {
  getDerivedProposalStatus,
  calculateQuorumAmount,
} from "../../lib/utils/proposal";
import {
  decodeProposalDescription,
  DecodedProposalDescription,
} from "../../lib/utils/descriptionDecoder";
import { proposals, quorum_overrides } from "../../generated/prisma";

interface ActiveProposalQueryParams {
  page_size?: string;
  page?: string;
}

interface PendingProposalQueryParams {
  created_by?: string;
  page_size?: string;
  page?: string;
}

/**
 * Calculate the effective quorum amount for a proposal.
 *
 * Priority order:
 * 1. Metadata quorum (from v1 encoded description)
 * 2. Database quorum override
 * 3. Default calculation (max of floor or percentage)
 */
function calculateEffectiveQuorum(
  totalVenearAtApproval: string | null | undefined,
  decodedDescription: DecodedProposalDescription,
  quorumOverride?: quorum_overrides | null
): string {
  // If v1 metadata contains quorum, use it (highest priority)
  if (decodedDescription.metadata?.quorum) {
    return decodedDescription.metadata.quorum;
  }

  // Otherwise, use the standard calculation with optional override
  return calculateQuorumAmount(totalVenearAtApproval, quorumOverride);
}

function mapRecordToResponse(
  record: proposals,
  quorumOverride?: quorum_overrides | null
) {
  // Decode the description to extract version and metadata
  const decodedDescription = decodeProposalDescription(
    record.proposalDescription
  );

  return {
    id: record.id,
    approvedAt: record.approvedAt,
    approverId: record.approverId,
    createdAt: record.createdAt,
    creatorId: record.creatorId,
    hasVote: record.hasVotes,
    isApproved: record.isApproved,
    isRejected: record.isRejected,
    // Return the decoded (metadata-stripped) description
    proposalDescription: decodedDescription.description,
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
    quorumAmount: calculateEffectiveQuorum(
      record.totalVenearAtApproval?.toFixed(),
      decodedDescription,
      quorumOverride
    ),
    status: getDerivedProposalStatus(record),
    votingStartTimeNs: record.votingStartAt
      ? convertMsToNanoSeconds(record.votingStartAt.getTime())
      : null,
    votingCreatedAtNs: record.createdAt
      ? convertMsToNanoSeconds(record.createdAt.getTime())
      : null,
    // New metadata fields from v1 encoding
    descriptionVersion: decodedDescription.version,
    proposalMetadata: decodedDescription.metadata,
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

      // Fetch proposals with potential quorum overrides
      const records = await prisma.proposals.findMany({
        where: { isApproved: true, isRejected: false },
        orderBy: { createdAt: "desc" },
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
      });

      const count = await prisma.proposals.count({
        where: { isApproved: true, isRejected: false },
      });

      // Fetch quorum overrides for each proposal
      const proposalsWithQuorum = await Promise.all(
        records.map(async (record) => {
          if (!record.proposalId) {
            return mapRecordToResponse(record, null);
          }

          const overrides = await prisma.quorum_overrides.findMany({
            where: {
              startingFromId: {
                lte: record.proposalId,
              },
            },
            orderBy: {
              startingFromId: "desc",
            },
            take: 1,
          });

          return mapRecordToResponse(record, overrides[0] || null);
        })
      );

      res.status(200).json({
        proposals: proposalsWithQuorum,
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

      // Decode description to check for metadata quorum
      const decodedDescription = decodeProposalDescription(
        proposal.proposalDescription
      );

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

      const quorumAmount = calculateEffectiveQuorum(
        proposal.totalVenearAtApproval?.toFixed(),
        decodedDescription,
        overrides[0] || null
      );

      res.status(200).json({
        quorumAmount,
        // Include source information for transparency
        quorumSource: decodedDescription.metadata?.quorum
          ? "proposal_metadata"
          : overrides[0]
            ? "database_override"
            : "default_calculation",
        descriptionVersion: decodedDescription.version,
        proposalMetadata: decodedDescription.metadata,
      });
    } catch (error) {
      console.error("Error fetching proposal quorum:", error);
      res.status(500).json({ error: "Failed to fetch proposal quorum" });
    }
  };
}
