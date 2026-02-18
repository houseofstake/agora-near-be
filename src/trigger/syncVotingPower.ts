import { schedules } from "@trigger.dev/sdk/v3";
import { providers } from "near-api-js";
import { prisma } from "../index";
import { getRpcUrl } from "../lib/utils/rpc";
import { VENEAR_CONTRACT_ID } from "../lib/constants/contractConstants";

const BATCH_SIZE = 10;

/**
 * Calls ft_balance_of on the veNEAR contract for a single account.
 * Returns the raw balance string, or null on failure.
 */
async function fetchVotingPower(
  provider: providers.JsonRpcProvider,
  accountId: string,
): Promise<string | null> {
  try {
    const argsBase64 = Buffer.from(
      JSON.stringify({ account_id: accountId }),
    ).toString("base64");

    const result = await provider.query({
      request_type: "call_function",
      account_id: VENEAR_CONTRACT_ID,
      method_name: "ft_balance_of",
      args_base64: argsBase64,
      finality: "final",
    });

    const resultArray = (result as any).result;
    const balance = JSON.parse(Buffer.from(resultArray).toString());
    return String(balance);
  } catch (error) {
    console.error(
      `Failed to fetch voting power for ${accountId}:`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/**
 * Processes a batch of accounts: fetches on-chain voting power and upserts into cache.
 */
async function processBatch(
  provider: providers.JsonRpcProvider,
  accountIds: string[],
): Promise<{ successes: number; failures: number }> {
  const results = await Promise.allSettled(
    accountIds.map((id) => fetchVotingPower(provider, id)),
  );

  let successes = 0;
  let failures = 0;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const accountId = accountIds[i];

    if (result.status === "fulfilled" && result.value !== null) {
      await prisma.voting_power_cache.upsert({
        where: { accountId },
        update: {
          votingPower: result.value,
          updatedAt: new Date(),
        },
        create: {
          accountId,
          votingPower: result.value,
        },
      });
      successes++;
    } else {
      failures++;
    }
  }

  return { successes, failures };
}

/**
 * Scheduled task: syncs on-chain voting power for all registered voters.
 * Runs every hour.
 */
export const syncVotingPowerTask = schedules.task({
  id: "sync-voting-power",
  cron: "0 * * * *",
  run: async () => {
    const startTime = Date.now();
    console.log("Starting voting power sync...");

    try {
      const voters = await prisma.registeredVoters.findMany({
        where: {
          registeredVoterId: { not: null },
        },
        select: {
          registeredVoterId: true,
        },
      });

      const accountIds = voters
        .map((v) => v.registeredVoterId)
        .filter((id): id is string => id !== null);

      console.log(`Found ${accountIds.length} registered voters to sync`);

      if (accountIds.length === 0) {
        return { success: true, totalVoters: 0, elapsed: 0 };
      }

      const rpcUrl = getRpcUrl({ networkId: "mainnet" });
      const provider = new providers.JsonRpcProvider({ url: rpcUrl });

      let totalSuccesses = 0;
      let totalFailures = 0;

      for (let i = 0; i < accountIds.length; i += BATCH_SIZE) {
        const batch = accountIds.slice(i, i + BATCH_SIZE);
        const { successes, failures } = await processBatch(provider, batch);
        totalSuccesses += successes;
        totalFailures += failures;

        console.log(
          `Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(accountIds.length / BATCH_SIZE)}: ${successes} ok, ${failures} failed`,
        );
      }

      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(
        `Voting power sync complete: ${totalSuccesses} synced, ${totalFailures} failed, ${elapsed}s elapsed`,
      );

      return {
        success: true,
        totalVoters: accountIds.length,
        synced: totalSuccesses,
        failed: totalFailures,
        elapsedSeconds: elapsed,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Voting power sync failed:", error);
      throw new Error(
        `Failed to sync voting power: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  },
});
