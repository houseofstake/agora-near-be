import dotenv from "dotenv";
dotenv.config();

import { PrismaClient } from "../generated/prisma";
import { syncAllDelegatesToMeilisearch } from "../lib/meilisearch/sync";

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY web2.delegate_aggregates`;
  const count = await syncAllDelegatesToMeilisearch(prisma);
  console.log(`Synced ${count} delegates to Meilisearch`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
