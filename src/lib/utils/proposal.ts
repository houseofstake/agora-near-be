import { proposals, quorum_overrides } from "../../generated/prisma";
import { convertNanoSecondsToMs } from "./time";
import Big from "big.js";

const DEFAULT_QUORUM_PERCENTAGE = "0.35";

export function getDerivedProposalStatus(proposal: proposals) {
  const startTimeMs = proposal.votingStartAt?.getTime();
  const votingDurationMs = convertNanoSecondsToMs(
    proposal.votingDurationNs?.toFixed()
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
  quorumOverride?: quorum_overrides | null
): string {

  // Determine Quorum Floor based on environment
  // Prod: 7M veNEAR (Strict)
  // Dev/Staging: process.env.QUORUM_FLOOR or 10 veNEAR (Flexible)
  const isProd = process.env.AGORA_ENV === "prod" || process.env.NODE_ENV === "production";
  
  let floorValue = "7000000000000000000000000000000"; // Default Prod: 7M veNEAR

  if (!isProd) {
     floorValue = process.env.QUORUM_FLOOR || "10000000000000000000000000"; // 10 veNEAR
  }

  const quorumFloor = new Big(floorValue);
  const totalVenear = totalVenearAtApproval
    ? new Big(totalVenearAtApproval)
    : new Big(0);
  const percentageBasedQuorum = new Big(DEFAULT_QUORUM_PERCENTAGE).mul(
    totalVenear
  );

  // Default calculation: max(QUORUM_FLOOR_YOCTONEAR, DEFAULT_QUORUM_PERCENTAGE * totalVenearAtApproval)
  let quorumAmount = percentageBasedQuorum.gt(quorumFloor)
    ? percentageBasedQuorum.toFixed(0)
    : quorumFloor.toFixed(0);

  if (quorumOverride) {
    switch (quorumOverride.overrideType) {
      case "fixed":
        // Override to a fixed value
        quorumAmount = quorumOverride.overrideValue || quorumAmount;
        break;
      case "percentage":
        // Override to a percentage of the total voting power
        if (quorumOverride.overrideValue) {
          const overrideValue = new Big(quorumOverride.overrideValue);
          quorumAmount = overrideValue.mul(totalVenear).toFixed(0);
        }
        break;
      case "none":
      // No override, use the default calculation
      default:
        break;
    }
  }

  return quorumAmount;
}
