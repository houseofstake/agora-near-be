export enum ProposalType {
  SimpleMajority = "SimpleMajority",
  SuperMajority = "SuperMajority",
}

export interface ProposalMetadata {
  proposalType?: ProposalType;
  quorumThreshold?: number;
  approvalThreshold?: number;
}

// Prefix: 4 null bytes
export const METADATA_PREFIX = "\x00\x00\x00\x00";
// Version: 0x0001 (stored as 2 bytes: \x00\x01)
export const METADATA_VERSION = "\x00\x01";

export const decodeMetadata = (
  fullDescription: string
): { metadata: ProposalMetadata | null; description: string } => {
  if (!fullDescription.startsWith(METADATA_PREFIX)) {
    return { metadata: null, description: fullDescription };
  }

  const version = fullDescription.slice(4, 6);
  if (version !== METADATA_VERSION) {
    return { metadata: null, description: fullDescription };
  }

  const remaining = fullDescription.slice(6);
  const lastPipeIndex = remaining.lastIndexOf("|");

  if (lastPipeIndex === -1) {
    return { metadata: null, description: remaining };
  }

  const cleanDescription = remaining.substring(0, lastPipeIndex);
  const metadataString = remaining.substring(lastPipeIndex + 1);

  const metadata: ProposalMetadata = { proposalType: ProposalType.SimpleMajority };

  const pairs = metadataString.split(",");

  for (const pair of pairs) {
    const [key, value] = pair.split("=");
    if (!key || !value) continue;

    if (key === "proposal_type") {
      if (value === "SimpleMajority")
        metadata.proposalType = ProposalType.SimpleMajority;
      else if (value === "SuperMajority")
        metadata.proposalType = ProposalType.SuperMajority;
    }
  }
  
  return { metadata, description: cleanDescription };
};
