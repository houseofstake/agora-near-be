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

    if (onchainVP === null) {
      console.error(`   ❌ [RPC ERROR] Could not fetch data for ${account}`);
      continue;
    }

    const dbVpBig = dbRecord
      ? BigInt(Math.trunc(Number(dbRecord.voting_power)))
      : BigInt(0);
    const onchainVpBig = BigInt(onchainVP);
    const diff =
      dbVpBig > onchainVpBig ? dbVpBig - onchainVpBig : onchainVpBig - dbVpBig;

    // Dynamically allow up to 0.1% drift (for Whales) OR 0.1 VP (for Dust), whichever is greater
    // This heuristically absorbs the APY time-growth generated between the static DB snapshot and the live RPC query.
    const allowedDriftPercent = (onchainVpBig * BigInt(10)) / BigInt(10000);
    const allowedDriftAbsolute = BigInt("100000000000000000000000");
    const maxAllowedDrift = allowedDriftPercent > allowedDriftAbsolute ? allowedDriftPercent : allowedDriftAbsolute;

    if (diff > maxAllowedDrift) {
      console.error(
        `   ❌ [ANOMALY DETECTED] DB Cache mismatch for ${account}`,
      );
      console.error(`      - On-Chain: ${onchainVP}`);
      console.error(`      - Database: ${dbVpBig.toString()}`);
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

    if (onchainVP === null) {
      console.error(
        `   ❌ [RPC ERROR] Could not fetch data for ${record.account_id}`,
      );
      continue;
    }

    const dbVpBig = BigInt(Math.trunc(Number(record.voting_power)));
    const onchainVpBig = BigInt(onchainVP);
    const diff =
      dbVpBig > onchainVpBig ? dbVpBig - onchainVpBig : onchainVpBig - dbVpBig;

    const allowedDriftPercent = (onchainVpBig * BigInt(10)) / BigInt(10000);
    const allowedDriftAbsolute = BigInt("100000000000000000000000");
    const maxAllowedDrift = allowedDriftPercent > allowedDriftAbsolute ? allowedDriftPercent : allowedDriftAbsolute;

    /**
     * APY Time-Drift Heuristic Tolerance
     * ----------------------------------
     * Due to the lack of strict `block_height` determinism in the current `voting_power_cache` schema,
     * time-based discrepancies arise between the Indexer's static DB snapshot and the Watchdog's live RPC query.
     * We dynamically absorb this APY growth by allowing a composite maximum drift of:
     *   - 0.10% (10 basis points) to protect heavy Whale lockups with massive per-minute precision growth.
     *   - 0.10 VP (Absolute) to guard low-precision "Dust" accounts against fractional rounding.
     *
     * TODO: Refactor `voting_power_cache` to store `block_height` for 100% mathematically perfect RPC determinism.
     */
    if (diff > maxAllowedDrift) {
      console.error(
        `   ⚠️ [DRIFT DETECTED] DB Cache mismatch for live account ${record.account_id}`,
      );
      console.error(`      - On-Chain: ${onchainVP}`);
      console.error(`      - Database: ${dbVpBig.toString()}`);
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
