/**
 * Standalone script to sync on-chain voting power from venear.dao
 * into the voting_power_cache table.
 *
 * Designed to run as a Cloud Run Job triggered by Cloud Scheduler.
 * Can also be run locally: npm run sync:voting-power
 */
import dotenv from "dotenv";
dotenv.config();

import { PrismaClient } from "../generated/prisma";
import { providers } from "near-api-js";
import { getRpcUrl } from "../lib/utils/rpc";
import { VENEAR_CONTRACT_ID } from "../lib/constants/contractConstants";

const BATCH_SIZE = 10;

const prisma = new PrismaClient();

async function fetchVotingPower(
  provider: providers.JsonRpcProvider,
  accountId: string,
): Promise<string | null> {
  try {
    const result = await provider.query<any>({
      request_type: "call_function",
      account_id: VENEAR_CONTRACT_ID,
      method_name: "ft_balance_of",
      args_base64: Buffer.from(
        JSON.stringify({ account_id: accountId }),
      ).toString("base64"),
      finality: "final",
    });

    const balance = JSON.parse(Buffer.from(result.result).toString());
    return typeof balance === "string" ? balance : String(balance);
  } catch (error) {
    console.error(`Failed to fetch voting power for ${accountId}:`, error);
    return null;
  }
}

async function syncVotingPower(): Promise<void> {
  console.log("Starting voting power sync...");
  const startTime = Date.now();

  // Fetch all registered voter IDs
  const voters = await prisma.$queryRaw<{ registered_voter_id: string }[]>`
    SELECT registered_voter_id FROM fastnear.registered_voters
    WHERE registered_voter_id IS NOT NULL
  `;

  console.log(`Found ${voters.length} registered voters`);

  if (voters.length === 0) {
    console.log("No voters to sync. Exiting.");
    return;
  }

  // Initialize RPC provider
  const rpcUrl = getRpcUrl({ networkId: "mainnet" });
  const provider = new providers.JsonRpcProvider({ url: rpcUrl });

  let successCount = 0;
  let failCount = 0;

  // Process in batches
  for (let i = 0; i < voters.length; i += BATCH_SIZE) {
    const batch = voters.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(voters.length / BATCH_SIZE);

    console.log(`Processing batch ${batchNum}/${totalBatches}...`);

    const results = await Promise.allSettled(
      batch.map(async (voter) => {
        const balance = await fetchVotingPower(
          provider,
          voter.registered_voter_id,
        );
        if (balance === null) return null;

        return {
          accountId: voter.registered_voter_id,
          votingPower: balance,
        };
      }),
    );

    // Upsert successful results
    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        try {
          await prisma.$executeRaw`
            INSERT INTO web2.voting_power_cache (account_id, voting_power, updated_at)
            VALUES (${result.value.accountId}, ${result.value.votingPower}::decimal, NOW())
            ON CONFLICT (account_id)
            DO UPDATE SET voting_power = ${result.value.votingPower}::decimal, updated_at = NOW()
          `;
          successCount++;
        } catch (error) {
          console.error(
            `Failed to upsert voting power for ${result.value.accountId}:`,
            error,
          );
          failCount++;
        }
      } else {
        failCount++;
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(
    `Voting power sync complete in ${elapsed}s. Success: ${successCount}, Failed: ${failCount}`,
  );
}

// Run and exit
syncVotingPower()
  .then(() => {
    console.log("Script finished successfully.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
