import { proposals } from "../../generated/prisma";
import { convertNanoSecondsToMs } from "./time";

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
