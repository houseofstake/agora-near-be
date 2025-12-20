export enum ProposalType {
  SimpleMajority = "SimpleMajority",
  SuperMajority = "SuperMajority",
}

export interface ProposalMetadata {
  proposalType?: ProposalType;
  quorumThreshold?: number;
  approvalThreshold?: number;
}

// Postgres TEXT columns do not support NULL bytes (\x00).
// We use Record Separator (\x1E) as a safe alternative.
export const METADATA_PREFIX = "\u001E\u001E\u001E\u001E";
// Version 1: \u0001\u0001 (Avoids \x00)
export const METADATA_VERSION = "\u0001\u0001";
export const THRESHOLD_PRECISION = 10000;

export const THRESHOLD_BASIS_POINTS = {
  SUPER_MAJORITY: 6667, // ~2/3
  SIMPLE_MAJORITY: 5000, // 0.5
};

export const PROPOSAL_APPROVAL_THRESHOLDS: Record<ProposalType, number> = {
  [ProposalType.SimpleMajority]: 0.5,
  [ProposalType.SuperMajority]: 2 / 3,
};

export function getApprovalThreshold(type?: ProposalType | null): number {
  return PROPOSAL_APPROVAL_THRESHOLDS[type ?? ProposalType.SimpleMajority] ?? 0.5;
}

export function decodeMetadata(fullDescription: string): {
  metadata: ProposalMetadata | null;
  description: string;
} {
  // 1. Try to parse V1 Metadata
  if (fullDescription.startsWith(METADATA_PREFIX)) {
    const version = fullDescription.slice(4, 6);
    if (version !== METADATA_VERSION) {
      // If prefix exists but version mismatch
      return { metadata: null, description: fullDescription };
    }
    const remaining = fullDescription.slice(6);
    const lastPipeIndex = remaining.lastIndexOf("|");
    if (lastPipeIndex === -1) {
      return { metadata: null, description: fullDescription };
    }
    const cleanDescription = remaining.substring(0, lastPipeIndex);
    const metadataString = remaining.substring(lastPipeIndex + 1);
    const metadata: ProposalMetadata = {};
    const pairs = metadataString.split(",");
    
    for (const pair of pairs) {
      const [key, value] = pair.split("=");
      if (!key || !value) continue;
      
      if (key === "approval_threshold") {
        const rawValue = parseInt(value, 10);
        if (rawValue > 0) {
          // Determining Type.
          metadata.approvalThreshold = rawValue / THRESHOLD_PRECISION;

          if (rawValue >= THRESHOLD_BASIS_POINTS.SUPER_MAJORITY) {
            metadata.proposalType = ProposalType.SuperMajority;
          } else if (rawValue >= THRESHOLD_BASIS_POINTS.SIMPLE_MAJORITY) {
            metadata.proposalType = ProposalType.SimpleMajority;
          } else {
            // Assuming 'Standard' is not defined, fallback to SimpleMajority.
            metadata.proposalType = ProposalType.SimpleMajority;
          }
        }
      }
    }
    return { metadata, description: cleanDescription };
  }

  // 2. Default
  return { metadata: null, description: fullDescription };
}
