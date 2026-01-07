import { proposals, quorum_overrides } from "../../generated/prisma";
import { ProposalMetadata } from "./proposalMetadata";
import { convertNanoSecondsToMs } from "./time";
import Big from "big.js";

export const DEFAULT_QUORUM_PERCENTAGE_BPS = '3500';

export function getDerivedProposalStatus(proposal: proposals) {
  const startTimeMs = proposal.votingStartAt?.getTime();
  const votingDurationMs = convertNanoSecondsToMs(
    proposal.votingDurationNs?.toFixed(),
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

export function calculateQuorumAmount(
  totalVenearAtApproval: string | null | undefined,
  quorumOverride: quorum_overrides | null,
  metadata: ProposalMetadata,
): string {
  // Determine Quorum Floor based on environment
  // Prod: 7M veNEAR (Strict)
  // Dev/Staging: process.env.QUORUM_FLOOR or 10 veNEAR (Flexible)
  const isProd = process.env.AGORA_ENV === "prod";

  let floorValue = "7000000000000000000000000000000"; // Default Prod: 7M veNEAR
  if (!isProd) {
    floorValue = process.env.QUORUM_FLOOR || "10000000000000000000000000"; // 10 veNEAR
  }

  const quorumFloor = new Big(floorValue);
  const totalVenear = totalVenearAtApproval
    ? new Big(totalVenearAtApproval)
    : new Big(0);

  // For metadata.version = 0, it's implicitly set to DEFAULT_QUORUM_PERCENTAGE_BPS
  // For metadata.version = 1, it either defaults to DEFAULT_QUORUM_PERCENTAGE_BPS or is set explicitly.
  let percentageBasedQuorum = new Big(metadata.quorum).mul(totalVenear).div(10000);

  // Default calculation: max(QUORUM_FLOOR_YOCTONEAR, DEFAULT_QUORUM_PERCENTAGE * totalVenearAtApproval)
  let quorumAmount = percentageBasedQuorum.gt(quorumFloor)
    ? percentageBasedQuorum
    : quorumFloor;

  if (quorumOverride) {
    switch (quorumOverride.overrideType) {
      case "fixed":
        // Override to a fixed value
        quorumAmount =
          quorumOverride.overrideValue !== null
            ? new Big(quorumOverride.overrideValue)
            : quorumAmount;
        break;
      case "percentage":
        // Override to a percentage of the total voting power
        if (quorumOverride.overrideValue) {
          const overrideValue = new Big(quorumOverride.overrideValue);
          quorumAmount = overrideValue.mul(totalVenear).div(10000);
        }
        break;
      case "none":
      // No override, use the default calculation
      default:
        break;
    }
  }

  return quorumAmount.toFixed(0);
}

// Quorum Strategy

// This is the expected behaviour in prod:

// 2025
// For metadata.version = 0, quorum is set to max(35% x total veNEAR, constant floor value) + honoring a "fixed" perpetuity-override

// 2026
// For metadata.version = 1, if onchain quorum <= 10000, quorum is set to max(value x total veNEAR, constant floor value) + honoring perpetuity-override
//.              Optionally, if onchain quorum  > 10000, quorum is set to value + honoring perpetuity-override

// >= 2026-01
// For metadata.version = 2, if onchain quorum <= 10000, quorum is set to max(value x total veNEAR, constant floor value)
//.              Optionally, if onchain quorum  > 10000, quorum is set to value

// ~ 2026-03
// For metadata.version = 3, get quorum info from onchain types or something else TBD.