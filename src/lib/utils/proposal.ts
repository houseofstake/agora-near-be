import { convertNanoSecondsToMs } from "./time";
import { proposal } from "../../generated/prisma";

export function getDerivedProposalStatus(proposal: proposal) {
  const startTimeMs = proposal.voting_start_at?.getTime();
  const votingDurationMs = convertNanoSecondsToMs(
    proposal.voting_duration_ns?.toFixed()
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
