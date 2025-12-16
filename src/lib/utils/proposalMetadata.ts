export enum ProposalType {
  Standard = "Standard",
  Tactical = "Tactical",
  SimpleMajority = "SimpleMajority",
  SuperMajority = "SuperMajority",
}

export interface ProposalMetadata {
  proposalType: ProposalType;
  quorumThreshold?: number;
  approvalThreshold?: number;
}

export const decodeMetadata = (
  description: string
): { metadata: ProposalMetadata | null; description: string } => {
  const metadataRegex = /```json:metadata\s*([\s\S]*?)\s*```/;
  const match = description.match(metadataRegex);

  if (match && match[1]) {
    try {
      const metadata = JSON.parse(match[1]);
      const cleanDescription = description.replace(metadataRegex, "").trim();
      return { metadata, description: cleanDescription };
    } catch (e) {
      console.error("Failed to parse metadata JSON", e);
    }
  }
  return { metadata: null, description };
};
