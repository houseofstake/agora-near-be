import { proposals, quorum_overrides } from "../../generated/prisma";
import { convertNanoSecondsToMs } from "./time";
import Big from "big.js";

const QUORUM_FLOOR_YOCTONEAR = "7000000000000000000000000000000"; // 7M veNEAR
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

import { utils } from "near-api-js";

export function calculateQuorumAmount(
  totalVenearAtApproval: string | null | undefined,
  quorumOverride?: quorum_overrides | null
): string {

  const quorumFloor = new Big(QUORUM_FLOOR_YOCTONEAR);
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
