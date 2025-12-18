export enum ProposalType {
  SimpleMajority = "SimpleMajority",
  SuperMajority = "SuperMajority",
}

export interface ProposalMetadata {
  proposalType: ProposalType;
  quorumThreshold?: number;
  approvalThreshold?: number;
}

const METADATA_REGEX = /```json:metadata\s*([\s\S]*?)\s*```/;

export const decodeMetadata = (
  description: string
): { metadata: ProposalMetadata | null; description: string } => {
  const match = description.match(METADATA_REGEX);

  if (match && match[1]) {
    try {
      const metadata = JSON.parse(match[1]);
      const cleanDescription = description.replace(METADATA_REGEX, "").trim();
      return { metadata, description: cleanDescription };
    } catch (e) {
      console.error("Failed to parse metadata JSON", e);
    }
  }
  return { metadata: null, description };
};
