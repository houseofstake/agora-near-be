import { schedules } from "@trigger.dev/sdk/v3";
import { NotificationManager } from "../lib/notifications/notificationManager";
import { prisma } from "../index";

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

const mapProposalToNotificationData = (
  proposal: any
): ProposalNotificationData => {
  const startDate = proposal.voting_start_at
    ? new Date(Number(proposal.voting_start_at))
    : new Date();

  const endDate =
    proposal.voting_start_at && proposal.voting_duration_ns
      ? new Date(
          Number(proposal.voting_start_at) + Number(proposal.voting_duration_ns)
        )
      : undefined;

  return {
    proposalId: proposal.id.toString(),
    proposalTitle: proposal.proposalTitle || `Proposal ${proposal.id}`,
    proposalUrl: `${process.env.FRONTEND_URL}proposals/${proposal.id}`,
    startDate,
    endDate,
  };
};

// Check for new proposals every 2 hours
export const checkNewProposalsTask = schedules.task({
  id: "check-new-proposals",
  cron: "0 */2 * * *", // Every 2 hours
  run: async (payload, { ctx }) => {
    console.log("Checking for new proposals...");

    try {
      const timeCutoff = new Date(Date.now() - HOURS_2_IN_MS);
      const now = new Date();

      const newProposals = await prisma.proposal.findMany({
        where: {
          isApproved: true,
          isRejected: false,
          voting_start_at: { not: null },
          // Check if voting started recently (proxy for when proposal became active)
          OR: [
            {
              createdAt: {
                gte: timeCutoff,
              },
            },
            {
              // Also include proposals where voting started recently
              voting_start_at: {
                gte: (now.getTime() - HOURS_2_IN_MS).toString(),
              },
            },
          ],
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      console.log(`Found ${newProposals.length} new proposals to notify about`);

      if (newProposals.length === 0) {
        return {
          success: true,
          proposalsProcessed: 0,
          timestamp: new Date().toISOString(),
        };
      }

      const createdProposals = newProposals.map(mapProposalToNotificationData);
      await notificationManager.sendBulkNotifications(createdProposals, []);

      console.log(
        `Successfully processed ${createdProposals.length} new proposals`
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
        }`
      );
    }
  },
});

// Check for proposals ending soon every 2 hours (offset by 1 hour to avoid conflicts)
export const checkProposalsEndingSoonTask = schedules.task({
  id: "check-proposals-ending-soon",
  cron: "0 1-23/2 * * *", // Every 2 hours starting at 1:00 (offset from new proposals)
  run: async (payload, { ctx }) => {
    console.log("Checking for proposals ending soon...");

    try {
      const now = new Date();
      const twentyFourHoursFromNow = new Date(now.getTime() + HOURS_24_IN_MS);

      // Get active proposals that end within 24 hours
      const endingSoonProposals = await prisma.proposal.findMany({
        where: {
          isApproved: true,
          isRejected: false,
          voting_start_at: { not: null },
          voting_duration_ns: { not: null },
        },
      });

      // Filter proposals that are actually ending soon
      const filteredProposals = endingSoonProposals.filter((proposal) => {
        if (!proposal.voting_start_at || !proposal.voting_duration_ns)
          return false;

        const startTime = Number(proposal.voting_start_at);
        const duration = Number(proposal.voting_duration_ns);
        const endTime = new Date(startTime + duration);

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

      const endingSoonData = endingSoonProposals.map(
        mapProposalToNotificationData
      );
      await notificationManager.sendBulkNotifications([], endingSoonData);

      console.log(
        `Successfully processed ${endingSoonData.length} ending soon proposals`
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
        }`
      );
    }
  },
});
