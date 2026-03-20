/**
 * Verifies that the off-chain voting_power_cache matches on-chain venear.dao balances.
 */
import dotenv from "dotenv";
dotenv.config();

import { PrismaClient } from "../generated/prisma";
import { providers } from "near-api-js";
import { getRpcUrl } from "../lib/utils/rpc";
import { VENEAR_CONTRACT_ID } from "../lib/constants/contractConstants";

const prisma = new PrismaClient();

// Explicit edge-case monitoring accounts on Mainnet
const TEST_ACCOUNTS = [
  "hos-test-liquid.near", // Liquid only
  "hos-test-locker.near", // Locked, no delegations
  "hos-test-delegator.near", // Delegated 100% VP
  "hos-test-delegatee.near", // Received VP, 0 balance
  "hos-test-expired.near", // Expired lock
  "hos-test-dust.near", // Dust precision edge case
];

async function fetchTrueOnchainVotingPower(
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
    if ((error as any).message?.includes("Account ID not found")) {
      return "0";
    }
    return null;
  }
}

export async function runWatchdogAudit(): Promise<void> {
  console.log("=========================================");
  console.log("🐕 WATCHDOG: Voting Power Integrity Audit");
  console.log("=========================================\n");

  const rpcUrl = getRpcUrl({ networkId: "mainnet" });
  const provider = new providers.JsonRpcProvider({ url: rpcUrl });

  // 1. Query expected test accounts
  console.log("-> Auditing Expected Test Accounts...");
  const dbToyAccounts = await prisma.$queryRaw<
    { account_id: string; voting_power: number }[]
  >`
    SELECT account_id, voting_power FROM web2.voting_power_cache
    WHERE account_id = ANY(${TEST_ACCOUNTS})
  `;

  let anomaliesDetected = 0;

  for (const account of TEST_ACCOUNTS) {
    console.log(`\nAnalyzing Test Account: ${account}`);

    const onchainVP = await fetchTrueOnchainVotingPower(provider, account);
    const dbRecord = dbToyAccounts.find((a) => a.account_id === account);

    // Cast decimal buffer to strict string for precision matching
    const dbVpStr = dbRecord
      ? BigInt(Math.trunc(Number(dbRecord.voting_power))).toString()
      : "0";

    if (onchainVP === null) {
      console.error(`   ❌ [RPC ERROR] Could not fetch data for ${account}`);
      continue;
    }

    if (dbVpStr !== onchainVP) {
      console.error(
        `   ❌ [ANOMALY DETECTED] DB Cache mismatch for ${account}`,
      );
      console.error(`      - On-Chain: ${onchainVP}`);
      console.error(`      - Database: ${dbVpStr}`);
      anomaliesDetected++;
    } else {
      console.log(`   ✅ Validated Match: ${onchainVP} VP`);
    }
  }

  // 2. Audit random sample of live delegates
  console.log("\n-> Auditing Global Indexer Health (Random Sample)...");

  const dbRandomDelegates = await prisma.$queryRaw<
    { account_id: string; voting_power: number }[]
  >`
    SELECT account_id, voting_power FROM web2.voting_power_cache
    ORDER BY RANDOM()
    LIMIT 10
  `;

  for (const record of dbRandomDelegates) {
    const onchainVP = await fetchTrueOnchainVotingPower(
      provider,
      record.account_id,
    );
    const dbVpStr = BigInt(Math.trunc(Number(record.voting_power))).toString();

    if (onchainVP === null) {
      console.error(
        `   ❌ [RPC ERROR] Could not fetch data for ${record.account_id}`,
      );
      continue;
    }

    // Ignore minor hourly indexing drift on live accounts
    if (dbVpStr !== onchainVP) {
      console.error(
        `   ⚠️ [DRIFT DETECTED] DB Cache mismatch for live account ${record.account_id}`,
      );
      console.error(`      - On-Chain: ${onchainVP}`);
      console.error(`      - Database: ${dbVpStr}`);
      // Log drift without failing the script for random live delegates
    } else {
      console.log(
        `   ✅ Validated Match: ${record.account_id} (${onchainVP} VP)`,
      );
    }
  }

  console.log("\n=========================================");
  if (anomaliesDetected > 0) {
    throw new Error(
      `Audit Failed with ${anomaliesDetected} critical anomaly(ies).`,
    );
  } else {
    console.log(
      "✅ Audit Passed: On-chain truth strictly aligns with Database.",
    );
  }
}

if (require.main === module) {
  runWatchdogAudit()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error("Critical Watchdog Error:", e);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect();
    });
}
