import { decodeMetadata, ProposalType } from "../proposalMetadata";

// Mock constants since they are inside the file and not exported effectively for testing if private
// But assuming decodeMetadata uses them internally.
const METADATA_PREFIX = "\u001E\u001E\u001E\u001E";
const METADATA_VERSION = "\u0001\u0001";

describe("decodeMetadata (Backend)", () => {
  it("should decode numeric threshold (SuperMajority)", () => {
    const description = "Body";
    const encoded = `${METADATA_PREFIX}${METADATA_VERSION}${description}|approval_threshold=6667`;

    const { metadata, description: cleanDesc } = decodeMetadata(encoded);

    expect(cleanDesc).toBe(description);
    expect(metadata).not.toBeNull();
    if (metadata) {
      expect(metadata.proposalType).toBe(ProposalType.SuperMajority);
      expect(metadata.approvalThreshold).toBe(0.6667);
    }
  });

  it("should decode numeric threshold (SimpleMajority)", () => {
    const description = "Body";
    const encoded = `${METADATA_PREFIX}${METADATA_VERSION}${description}|approval_threshold=5000`;

    const { metadata, description: cleanDesc } = decodeMetadata(encoded);

    expect(cleanDesc).toBe(description);
    expect(metadata).not.toBeNull();
    if (metadata) {
      expect(metadata.proposalType).toBe(ProposalType.SimpleMajority);
      expect(metadata.approvalThreshold).toBe(0.5);
    }
  });
});
