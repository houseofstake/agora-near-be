import dotenv from "dotenv";
dotenv.config();

import { PrismaClient } from "../generated/prisma";
import { providers } from "near-api-js";
import { getRpcUrl } from "../lib/utils/rpc";
import { VENEAR_CONTRACT_ID } from "../lib/constants/contractConstants";

const prisma = new PrismaClient();
const INTERVAL_HOURS = 24;
const MONTHS_BACK = 5;
const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_INTERVAL = INTERVAL_HOURS * MS_PER_HOUR;

async function fetchFtTotalSupplyAtBlock(
  provider: providers.JsonRpcProvider,
  blockId: number,
): Promise<string | null> {
  try {
    const result = await provider.query<any>({
      request_type: "call_function",
      account_id: VENEAR_CONTRACT_ID,
      method_name: "ft_total_supply",
      args_base64: Buffer.from(JSON.stringify({})).toString("base64"),
      block_id: blockId,
    });
    const supply = JSON.parse(Buffer.from(result.result).toString());
    return typeof supply === "string" ? supply : String(supply);
  } catch (error) {
    console.error(`Failed ft_total_supply at block ${blockId}:`, error);
    return null;
  }
}

function getTargetTimestamps(): Date[] {
  const end = new Date();
  end.setUTCMinutes(0, 0, 0);
  const start = new Date(end);
  start.setMonth(start.getMonth() - MONTHS_BACK);

  const hour = start.getUTCHours();
  const alignedHour = Math.floor(hour / INTERVAL_HOURS) * INTERVAL_HOURS;
  start.setUTCHours(alignedHour, 0, 0, 0);

  const timestamps: Date[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += MS_PER_INTERVAL) {
    timestamps.push(new Date(t));
  }
  return timestamps;
}

async function backfill(): Promise<void> {
  console.log("Starting venear total supply backfill...");
  const startTime = Date.now();

  const rpcUrl = getRpcUrl({ networkId: "mainnet", useArchivalNode: true });
  const provider = new providers.JsonRpcProvider({ url: rpcUrl });

  const targets = getTargetTimestamps();
  console.log(
    `Backfilling ${targets.length} points (every ${INTERVAL_HOURS}h for past ${MONTHS_BACK} months)`,
  );

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    const block = await prisma.fastnear_blocks.findFirst({
      where: { timestamp: { lte: target } },
      orderBy: { timestamp: "desc" },
      select: { height: true },
    });

    if (!block) {
      console.warn(`No block for ${target.toISOString()}, skipping`);
      skipCount++;
      continue;
    }

    const blockHeight = Number(block.height);
    const totalSupply = await fetchFtTotalSupplyAtBlock(provider, blockHeight);

    if (totalSupply === null) {
      failCount++;
      continue;
    }

    try {
      await prisma.$executeRaw`
        INSERT INTO web2.venear_total_supply_history (recorded_at, block_height, total_supply)
        VALUES (${target}, ${blockHeight}::bigint, ${totalSupply})
        ON CONFLICT (recorded_at) DO UPDATE SET block_height = ${blockHeight}::bigint, total_supply = ${totalSupply}
      `;
      successCount++;
    } catch (error) {
      console.error(`Failed to insert ${target.toISOString()}:`, error);
      failCount++;
    }

    if ((i + 1) % 50 === 0) {
      console.log(`Progress: ${i + 1}/${targets.length}`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(
    `Backfill complete in ${elapsed}s. Success: ${successCount}, Skipped: ${skipCount}, Failed: ${failCount}`,
  );
}

backfill()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
