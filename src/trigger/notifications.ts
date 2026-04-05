import { schedules } from "@trigger.dev/sdk";
import { NotificationManager } from "../lib/notifications/notificationManager";
import { convertNanoSecondsToMs } from "../lib/utils/time";

const notificationManager = new NotificationManager();

// Constants for time calculations
const HOURS_2_IN_MS = 2 * 60 * 60 * 1000;
const HOURS_24_IN_MS = 24 * 60 * 60 * 1000;

interface ProposalNotificationData {
  proposalId: string;
  proposalTitle: string;
  proposalUrl: string;
  startDate: Date;
  endDate?: Date;
}

interface ApprovedProposalApi {
  id: string;
  proposalTitle: string | null;
  createdAt: string;
  votingStartTimeNs: string | null;
  votingDurationNs: string | null;
  isApproved: boolean;
  isRejected: boolean;
}

interface ApprovedProposalsResponse {
  proposals: ApprovedProposalApi[];
  count: number;
}

function getApiBaseUrl(): string {
  const base = process.env.API_BASE_URL;
  if (!base) {
    throw new Error("API_BASE_URL is required for notification tasks");
  }
  return base.replace(/\/$/, "");
}

async function fetchAllApprovedProposals(): Promise<ApprovedProposalApi[]> {
  const base = getApiBaseUrl();
  const pageSize = 100;
  let page = 1;
  const all: ApprovedProposalApi[] = [];
  let total = Infinity;

  while (all.length < total) {
    const url = new URL(`${base}/api/proposal/approved`);
    url.searchParams.set("page", String(page));
    url.searchParams.set("page_size", String(pageSize));

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(
        `GET ${url.pathname} failed: ${res.status} ${res.statusText}`,
      );
    }

    const data = (await res.json()) as ApprovedProposalsResponse;
    total = data.count;

    if (data.proposals.length === 0) {
      break;
    }

    all.push(...data.proposals);

    if (data.proposals.length < pageSize) {
      break;
    }

    page += 1;
  }

  return all;
}

const mapApiProposalToNotificationData = (
  proposal: ApprovedProposalApi,
): ProposalNotificationData => {
  const votingStartMs =
    proposal.votingStartTimeNs != null
      ? convertNanoSecondsToMs(proposal.votingStartTimeNs)
      : null;

  const startDate =
    votingStartMs != null ? new Date(votingStartMs) : new Date();

  const endDate =
    votingStartMs != null && proposal.votingDurationNs != null
      ? new Date(votingStartMs + Number(proposal.votingDurationNs) / 1_000_000)
      : undefined;

  return {
    proposalId: String(proposal.id),
    proposalTitle: proposal.proposalTitle || `Proposal ${proposal.id}`,
    proposalUrl: `${process.env.FRONTEND_URL}proposals/${proposal.id}`,
    startDate,
    endDate,
  };
};

// Check for new proposals every 2 hours
export const checkNewProposalsTask = schedules.task({
  id: "check-new-proposals",
  cron: "0 */2 * * *",
  run: async (payload, { ctx }) => {
    console.log("Checking for new proposals...");

    try {
      const timeCutoff = new Date(Date.now() - HOURS_2_IN_MS);
      const proposals = await fetchAllApprovedProposals();

      const newProposals = proposals.filter((p) => {
        if (!p.isApproved || p.isRejected || p.votingStartTimeNs == null) {
          return false;
        }
        const createdAt = new Date(p.createdAt).getTime();
        const votingStartMs = convertNanoSecondsToMs(p.votingStartTimeNs);
        return (
          createdAt >= timeCutoff.getTime() ||
          votingStartMs >= timeCutoff.getTime()
        );
      });

      newProposals.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      console.log(`Found ${newProposals.length} new proposals to notify about`);

      if (newProposals.length === 0) {
        return {
          success: true,
          proposalsProcessed: 0,
          timestamp: new Date().toISOString(),
        };
      }

      const createdProposals = newProposals.map(
        mapApiProposalToNotificationData,
      );
      await notificationManager.sendBulkNotifications(createdProposals, []);

      console.log(
        `Successfully processed ${createdProposals.length} new proposals`,
      );

      return {
        success: true,
        proposalsProcessed: createdProposals.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Error checking for new proposals:", error);
      throw new Error(
        `Failed to check new proposals: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  },
});

// Check for proposals ending soon every 2 hours (offset by 1 hour to avoid conflicts)
export const checkProposalsEndingSoonTask = schedules.task({
  id: "check-proposals-ending-soon",
  cron: "0 1-23/2 * * *",
  run: async (payload, { ctx }) => {
    console.log("Checking for proposals ending soon...");

    try {
      const now = new Date();
      const twentyFourHoursFromNow = new Date(now.getTime() + HOURS_24_IN_MS);

      const proposals = await fetchAllApprovedProposals();

      const filteredProposals = proposals.filter((p) => {
        if (p.votingStartTimeNs == null || p.votingDurationNs == null) {
          return false;
        }

        const startMs = convertNanoSecondsToMs(p.votingStartTimeNs);
        const endTime = new Date(
          startMs + Number(p.votingDurationNs) / 1_000_000,
        );

        return endTime > now && endTime <= twentyFourHoursFromNow;
      });

      console.log(`Found ${filteredProposals.length} proposals ending soon`);

      if (filteredProposals.length === 0) {
        return {
          success: true,
          proposalsProcessed: 0,
          timestamp: new Date().toISOString(),
        };
      }

      const endingSoonData = filteredProposals.map(
        mapApiProposalToNotificationData,
      );
      await notificationManager.sendBulkNotifications([], endingSoonData);

      console.log(
        `Successfully processed ${endingSoonData.length} ending soon proposals`,
      );

      return {
        success: true,
        proposalsProcessed: endingSoonData.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Error checking for proposals ending soon:", error);
      throw new Error(
        `Failed to check ending soon proposals: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  },
});
