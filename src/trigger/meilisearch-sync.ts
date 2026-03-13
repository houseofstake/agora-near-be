import { schedules } from "@trigger.dev/sdk";
import { prisma } from "../index";
import { syncAllDelegatesToMeilisearch } from "../lib/meilisearch/sync";

export const syncDelegatesToMeilisearchTask = schedules.task({
  id: "sync-delegates-to-meilisearch",
  cron: "0 */3 * * *",
  run: async () => {
    console.log("Starting Meilisearch delegate sync...");

    try {
      await prisma.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY web2.delegate_aggregates`;
      const count = await syncAllDelegatesToMeilisearch(prisma);

      console.log(`Synced ${count} delegates to Meilisearch`);

      return {
        success: true,
        delegatesSynced: count,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Error syncing delegates to Meilisearch:", error);
      throw new Error(
        `Failed to sync delegates: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  },
});
