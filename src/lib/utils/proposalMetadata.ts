import Big from "big.js";
import { DEFAULT_QUORUM_PERCENTAGE_BPS } from "./proposal";

export enum ProposalType {
  SimpleMajority = "SimpleMajority",
  SuperMajority = "SuperMajority",
}

export interface ProposalMetadata {
  proposalType: ProposalType;
  quorum: number;
  approvalThreshold: number;
  version: number;
}

// Postgres TEXT columns do not support NULL bytes (\x00).
// We use Record Separator (\x1E) as a safe alternative.
export const METADATA_PREFIX = "\u001E\u001E\u001E\u001E";
// Version 1: \u0001\u0001 (Avoids \x00)
export const METADATA_VERSION = "\u0001\u0001";
export const THRESHOLD_PRECISION = 10000;

export const APPROVAL_THRESHOLD_BASIS_POINTS = {
  SUPER_MAJORITY: 6667, // ~2/3
  SIMPLE_MAJORITY: 5000, // 0.5
};

export function decodeMetadata(fullDescription: string): {
  metadata: ProposalMetadata;
  description: string;
} {
  let version = 0;
  let proposalType = ProposalType.SimpleMajority;
  let approvalThreshold = APPROVAL_THRESHOLD_BASIS_POINTS.SIMPLE_MAJORITY;
  let quorum = new Big(DEFAULT_QUORUM_PERCENTAGE_BPS).toNumber();

  const v0Metadata = {
    proposalType,
    quorum,
    approvalThreshold,
    version,
  };

  // 1. Try to parse V1 Metadata
  if (fullDescription.startsWith(METADATA_PREFIX)) {
    const rawVersion = fullDescription.slice(4, 6);
    if (rawVersion !== METADATA_VERSION) {
      // If prefix exists but version mismatch
      return { metadata: v0Metadata, description: fullDescription };
    } else {
      version = 1;
    }

    const remaining = fullDescription.slice(6);
    const lastPipeIndex = remaining.lastIndexOf("|");

    if (lastPipeIndex === -1) {
      return { metadata: v0Metadata, description: fullDescription };
    }

    const cleanDescription = remaining.substring(0, lastPipeIndex);
    const metadataString = remaining.substring(lastPipeIndex + 1);

    const pairs = metadataString.split(",");

    for (const pair of pairs) {
      const [key, value] = pair.split("=");
      if (!key || !value) continue;

      if (key === "approval_threshold") {
        const rawApprovalThreshold = parseInt(value, 10);
        if (rawApprovalThreshold > 0) {
          approvalThreshold = rawApprovalThreshold;

          if (
            approvalThreshold == APPROVAL_THRESHOLD_BASIS_POINTS.SUPER_MAJORITY
          ) {
            proposalType = ProposalType.SuperMajority;
          } else if (
            approvalThreshold == APPROVAL_THRESHOLD_BASIS_POINTS.SIMPLE_MAJORITY
          ) {
            proposalType = ProposalType.SimpleMajority;
          } else {
            throw new Error("Invalid approval threshold");
          }
        }
      }

      if (key == "quorum") {
        const rawQuorum = parseInt(value, 10);
        if (rawQuorum > 0) {
          // eg. "35" is already in basis points
          quorum = rawQuorum;
        }
      }
    }

    const metadata: ProposalMetadata = {
      version,
      quorum,
      approvalThreshold,
      proposalType,
    };

    return { metadata, description: cleanDescription };
  }

  return { metadata: v0Metadata, description: fullDescription };
}
