/**
 * Proposal Description Decoder
 *
 * Handles decoding of proposal descriptions that may contain embedded metadata.
 *
 * Encoding Format (v1):
 * - Bytes 0-3: Four null bytes (0x00 0x00 0x00 0x00) as marker
 * - Bytes 4-5: Unsigned 16-bit integer representing the decoding version
 * - Remaining: Human-readable proposal text with optional metadata
 * - Metadata section: After the last `|` character: key=value,key=value
 *
 * Supported keys (v1): approval_threshold, quorum
 *
 * v0 (legacy): No prefix, description returned as-is with no metadata
 */

// Version constants
export const DESCRIPTION_VERSION_V0 = 0;
export const DESCRIPTION_VERSION_V1 = 1;

// Null byte prefix for v1+ encoding (4 bytes)
const NULL_BYTE_PREFIX = "\x00\x00\x00\x00";
const NULL_BYTE_PREFIX_LENGTH = 4;
const VERSION_BYTES_LENGTH = 2;
const HEADER_LENGTH = NULL_BYTE_PREFIX_LENGTH + VERSION_BYTES_LENGTH;

// Valid metadata keys for v1
const VALID_V1_KEYS = new Set(["approval_threshold", "quorum"]);

/**
 * Metadata extracted from a v1-encoded proposal description
 */
export interface ProposalMetadataV1 {
  /** Approval threshold in yoctoNEAR (bigint string) */
  approval_threshold?: string;
  /** Quorum amount in yoctoNEAR (bigint string) */
  quorum?: string;
}

/**
 * Result of decoding a proposal description
 */
export interface DecodedProposalDescription {
  /** The decoded version (0 for legacy, 1+ for versioned) */
  version: number;
  /** The human-readable description text (metadata stripped) */
  description: string;
  /** Extracted metadata (only present for v1+) */
  metadata: ProposalMetadataV1 | null;
  /** Raw description before decoding (for debugging) */
  rawDescription: string;
}

/**
 * Check if a string starts with the null byte prefix indicating v1+ encoding
 */
function hasNullBytePrefix(description: string): boolean {
  if (description.length < HEADER_LENGTH) {
    return false;
  }

  // Check for 4 null bytes at the start
  for (let i = 0; i < NULL_BYTE_PREFIX_LENGTH; i++) {
    if (description.charCodeAt(i) !== 0) {
      return false;
    }
  }

  return true;
}

/**
 * Extract the version number from bytes 4-5 of the description
 * Version is stored as unsigned 16-bit integer (big-endian)
 */
function extractVersion(description: string): number {
  const byte1 = description.charCodeAt(NULL_BYTE_PREFIX_LENGTH);
  const byte2 = description.charCodeAt(NULL_BYTE_PREFIX_LENGTH + 1);

  // Big-endian: first byte is high byte
  return (byte1 << 8) | byte2;
}

/**
 * Parse metadata string into key-value pairs
 * Format: key=value,key=value,...
 */
function parseMetadataString(metadataStr: string): ProposalMetadataV1 {
  const metadata: ProposalMetadataV1 = {};

  if (!metadataStr || metadataStr.trim() === "") {
    return metadata;
  }

  const pairs = metadataStr.split(",");

  for (const pair of pairs) {
    const trimmedPair = pair.trim();
    if (!trimmedPair) continue;

    const equalIndex = trimmedPair.indexOf("=");
    if (equalIndex === -1) {
      // Missing '=' - skip this pair
      console.warn(
        `[DescriptionDecoder] Malformed metadata pair (missing '='): "${trimmedPair}"`
      );
      continue;
    }

    const key = trimmedPair.substring(0, equalIndex).trim();
    const value = trimmedPair.substring(equalIndex + 1).trim();

    // Only accept valid keys
    if (!VALID_V1_KEYS.has(key)) {
      console.warn(`[DescriptionDecoder] Unknown metadata key: "${key}"`);
      continue;
    }

    // Validate that value can be cast to bigint
    try {
      // Attempt to parse as bigint to validate
      if (value === "" || !/^\d+$/.test(value)) {
        console.warn(
          `[DescriptionDecoder] Invalid bigint value for key "${key}": "${value}"`
        );
        continue;
      }
      BigInt(value);

      // Store as string (per PRD: "Values are interpreted as strings, then cast to bigint during decoding")
      if (key === "approval_threshold") {
        metadata.approval_threshold = value;
      } else if (key === "quorum") {
        metadata.quorum = value;
      }
    } catch {
      console.warn(
        `[DescriptionDecoder] Failed to parse value for key "${key}": "${value}"`
      );
    }
  }

  return metadata;
}

/**
 * Extract metadata section from description (everything after the last '|')
 * Returns [descriptionWithoutMetadata, metadataString]
 */
function extractMetadataSection(
  description: string
): [string, string | null] {
  const lastPipeIndex = description.lastIndexOf("|");

  if (lastPipeIndex === -1) {
    // No metadata section
    return [description, null];
  }

  const textPart = description.substring(0, lastPipeIndex);
  const metadataPart = description.substring(lastPipeIndex + 1);

  return [textPart, metadataPart];
}

/**
 * Decode a v1 description
 */
function decodeV1(
  description: string,
  rawDescription: string
): DecodedProposalDescription {
  // Strip header (6 bytes: 4 null + 2 version)
  const bodyWithMetadata = description.substring(HEADER_LENGTH);

  // Extract metadata section
  const [descriptionText, metadataStr] = extractMetadataSection(bodyWithMetadata);

  // Parse metadata
  const metadata = metadataStr ? parseMetadataString(metadataStr) : {};

  return {
    version: DESCRIPTION_VERSION_V1,
    description: descriptionText.trim(),
    metadata: Object.keys(metadata).length > 0 ? metadata : null,
    rawDescription,
  };
}

/**
 * Decode a proposal description, extracting embedded metadata if present.
 *
 * @param description - The raw proposal description from the blockchain
 * @returns Decoded description with version, text, and metadata
 *
 * @example
 * // v0 (legacy) - no prefix
 * decodeProposalDescription("Regular proposal text")
 * // => { version: 0, description: "Regular proposal text", metadata: null, rawDescription: "..." }
 *
 * @example
 * // v1 - with prefix and metadata
 * decodeProposalDescription("\x00\x00\x00\x00\x00\x01Proposal text|approval_threshold=1000,quorum=500")
 * // => { version: 1, description: "Proposal text", metadata: { approval_threshold: "1000", quorum: "500" }, rawDescription: "..." }
 */
export function decodeProposalDescription(
  description: string | null | undefined
): DecodedProposalDescription {
  // Handle null/undefined
  if (!description) {
    return {
      version: DESCRIPTION_VERSION_V0,
      description: "",
      metadata: null,
      rawDescription: "",
    };
  }

  const rawDescription = description;

  // Check for v1+ encoding (null byte prefix)
  if (hasNullBytePrefix(description)) {
    const version = extractVersion(description);

    if (version === DESCRIPTION_VERSION_V1) {
      return decodeV1(description, rawDescription);
    }

    // Unknown version - fall back to v0 behavior but log warning
    console.warn(
      `[DescriptionDecoder] Unknown description version: ${version}, falling back to v0`
    );
  }

  // v0 (legacy) - return as-is
  return {
    version: DESCRIPTION_VERSION_V0,
    description: description,
    metadata: null,
    rawDescription,
  };
}

/**
 * Encode a proposal description with metadata (v1 format)
 *
 * This is primarily for testing and potential future use.
 * The frontend will handle encoding for proposal creation.
 *
 * @param description - The human-readable proposal text
 * @param metadata - Optional metadata to embed
 * @returns Encoded description string
 */
export function encodeProposalDescription(
  description: string,
  metadata?: ProposalMetadataV1
): string {
  // If no metadata, encode as v1 anyway to maintain consistency
  const version = DESCRIPTION_VERSION_V1;

  // Build prefix: 4 null bytes + 2 version bytes (big-endian)
  const prefix =
    NULL_BYTE_PREFIX +
    String.fromCharCode((version >> 8) & 0xff) +
    String.fromCharCode(version & 0xff);

  // Build metadata string
  let metadataSuffix = "";
  if (metadata && Object.keys(metadata).length > 0) {
    const pairs: string[] = [];
    if (metadata.approval_threshold) {
      pairs.push(`approval_threshold=${metadata.approval_threshold}`);
    }
    if (metadata.quorum) {
      pairs.push(`quorum=${metadata.quorum}`);
    }
    if (pairs.length > 0) {
      metadataSuffix = "|" + pairs.join(",");
    }
  }

  return prefix + description + metadataSuffix;
}
