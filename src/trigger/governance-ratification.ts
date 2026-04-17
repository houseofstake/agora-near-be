import { schedules } from "@trigger.dev/sdk/v3";
import { prisma } from "../index";

export const autoRatifyProposalsTask = schedules.task({
  id: "auto-ratify-proposals",
  cron: "0 * * * *",
  run: async () => {
    const now = new Date();

    try {
      const result = await prisma.proposal_governance_status.updateMany({
        where: {
          councilStatus: "ACTIVE",
          vetoDeadline: { lt: now },
        },
        data: {
          councilStatus: "RATIFIED",
          ratifiedAt: now,
        },
      });

      if (result.count > 0) {
        console.log(`Auto-ratified ${result.count} proposal(s)`);
      }

      return {
        success: true,
        ratifiedCount: result.count,
        timestamp: now.toISOString(),
      };
    } catch (error) {
      console.error("Error during auto-ratification:", error);
      throw new Error(
        `Failed to auto-ratify proposals: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  },
});
