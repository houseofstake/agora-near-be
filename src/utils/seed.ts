import { PrismaClient, Prisma } from "../generated/prisma";
import { faker } from "@faker-js/faker";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

// Constants
const VENEAR_CONTRACT = "v.r-1748895584.testnet";
const VOTING_CONTRACT = "vote.r-1748895584.testnet";
const NEAR_ACCOUNTS = [
  "alice.testnet",
  "bob.testnet",
  "charlie.testnet",
  "diana.testnet",
  "eve.testnet",
  "frank.testnet",
  "grace.testnet",
  "henry.testnet",
  "ivy.testnet",
  "jack.testnet",
  "kate.testnet",
  "liam.testnet",
  "mia.testnet",
  "noah.testnet",
  "olivia.testnet",
  "peter.testnet",
  "quinn.testnet",
  "ruby.testnet",
  "sam.testnet",
  "tina.testnet",
];

const SEED_COUNTS = {
  BLOCKS: 100,
  DEPLOY_LOCKUP: 50,
  STORAGE_DEPOSIT: 50,
  CREATE_PROPOSAL: 10,
  VOTE: 100,
  DELEGATE: 30,
  APPROVE_PROPOSAL: 8,
  DELEGATE_STATEMENTS: 15,
  CACHE_ENTRIES: 10,
};

const BASE_BLOCK_HEIGHT = BigInt(1000000);
const BASE_TIMESTAMP = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days ago

function generateBase64Args(data: any): string {
  return Buffer.from(JSON.stringify(data)).toString("base64");
}

function generateEventLog(eventType: string, data: any): string {
  return `EVENT_JSON:${JSON.stringify({
    standard: "nep141",
    version: "1.0.0",
    event: eventType,
    data: [data],
  })}`;
}

function getTimestamp(daysAgo: number): Date {
  return new Date(BASE_TIMESTAMP + daysAgo * 24 * 60 * 60 * 1000);
}

async function seedBlocks() {
  console.log("Seeding blocks...");

  const blocks: Prisma.fastnear_blocksCreateManyInput[] = Array.from(
    { length: SEED_COUNTS.BLOCKS },
    (_, i) => ({
      height: BASE_BLOCK_HEIGHT + BigInt(i),
      hash: randomUUID(),
      prev_hash: randomUUID(),
      author: faker.helpers.arrayElement(NEAR_ACCOUNTS),
      timestamp: getTimestamp(i - SEED_COUNTS.BLOCKS + 1),
      gas_price: (
        100000000 + faker.number.int({ min: 0, max: 50000000 })
      ).toString(),
      total_supply: "1000000000000000000000000000",
    })
  );

  await prisma.fastnear_blocks.createMany({
    data: blocks,
    skipDuplicates: true,
  });
}

function createActionTemplate(
  receiptId: string,
  index: number,
  methodName: string
) {
  return {
    id: faker.string.uuid(),
    block_height: BASE_BLOCK_HEIGHT + BigInt(index),
    receipt_id: receiptId,
    signer_account_id: faker.helpers.arrayElement(NEAR_ACCOUNTS),
    signer_public_key: faker.string.alphanumeric(88),
    gas_price: "100000000",
    action_kind: "FunctionCall",
    block_hash: randomUUID(),
    chunk_hash: randomUUID(),
    author: faker.helpers.arrayElement(NEAR_ACCOUNTS),
    method_name: methodName,
    gas: BigInt(faker.number.int({ min: 1000000, max: 10000000 })),
    action_index: 0,
  };
}

function createReceiptActions() {
  const actions: any[] = [];
  const receiptIds: string[] = [];
  const methodNames: string[] = [];
  let actionIndex = 0;

  // Helper to add actions
  const addActions = (
    count: number,
    methodName: string,
    createSpecific: (base: any, i: number) => any
  ) => {
    for (let i = 0; i < count; i++) {
      const receiptId = randomUUID();
      receiptIds.push(receiptId);
      methodNames.push(methodName);

      const base = createActionTemplate(receiptId, actionIndex + i, methodName);
      actions.push(createSpecific(base, i));
    }
    actionIndex += count;
  };

  // Deploy lockup actions
  addActions(SEED_COUNTS.DEPLOY_LOCKUP, "deploy_lockup", (base) => ({
    ...base,
    predecessor_id: base.signer_account_id,
    receiver_id: VENEAR_CONTRACT,
    deposit: "0",
    args_base64: generateBase64Args({}),
    block_timestamp: getTimestamp(
      -49 + Math.floor(actionIndex / SEED_COUNTS.DEPLOY_LOCKUP) * 49
    ),
  }));

  // Storage deposit actions
  addActions(SEED_COUNTS.STORAGE_DEPOSIT, "storage_deposit", (base) => ({
    ...base,
    predecessor_id: base.signer_account_id,
    receiver_id: VENEAR_CONTRACT,
    deposit: faker.number.int({ min: 1000000000, max: 10000000000 }).toString(),
    args_base64: generateBase64Args({
      account_id: base.signer_account_id,
      registration_only: false,
    }),
    block_timestamp: getTimestamp(
      -49 +
        Math.floor(
          (actionIndex - SEED_COUNTS.DEPLOY_LOCKUP) /
            SEED_COUNTS.STORAGE_DEPOSIT
        ) *
          49
    ),
  }));

  // Create proposal actions
  addActions(SEED_COUNTS.CREATE_PROPOSAL, "create_proposal", (base) => ({
    ...base,
    predecessor_id: base.signer_account_id,
    receiver_id: VOTING_CONTRACT,
    deposit: "0",
    args_base64: generateBase64Args({
      metadata: {
        title: faker.lorem.sentence(),
        description: faker.lorem.paragraphs(2),
        url: faker.internet.url(),
      },
    }),
    block_timestamp: getTimestamp(
      -40 +
        Math.floor(
          (actionIndex -
            SEED_COUNTS.DEPLOY_LOCKUP -
            SEED_COUNTS.STORAGE_DEPOSIT) /
            SEED_COUNTS.CREATE_PROPOSAL
        ) *
          40
    ),
  }));

  // Vote actions
  addActions(SEED_COUNTS.VOTE, "vote", (base, i) => ({
    ...base,
    predecessor_id: base.signer_account_id,
    receiver_id: VOTING_CONTRACT,
    deposit: "0",
    args_base64: generateBase64Args({
      proposal_id: faker.number.int({ min: 1, max: 10 }),
      vote: faker.number.int({ min: 0, max: 2 }),
      v_account: {
        V0: {
          balance: {
            near_balance: faker.number.int({ min: 1000000, max: 100000000 }),
            extra_venear_balance: faker.number.int({ min: 0, max: 50000000 }),
          },
          delegation: {
            account_id: faker.helpers.maybe(
              () => faker.helpers.arrayElement(NEAR_ACCOUNTS),
              { probability: 0.3 }
            ),
          },
          delegated_balance: {
            near_balance: faker.number.int({ min: 0, max: 50000000 }),
            extra_venear_balance: faker.number.int({ min: 0, max: 25000000 }),
          },
        },
      },
    }),
    block_timestamp: getTimestamp(-30 + (i % 30)),
  }));

  // Delegate actions
  addActions(SEED_COUNTS.DELEGATE, "delegate_all", (base, i) => {
    const availableAccounts = NEAR_ACCOUNTS.filter(
      (a) => a !== base.signer_account_id
    );
    return {
      ...base,
      predecessor_id: base.signer_account_id,
      receiver_id: VENEAR_CONTRACT,
      deposit: "0",
      args_base64: generateBase64Args({
        receiver_id: faker.helpers.arrayElement(availableAccounts),
      }),
      block_timestamp: getTimestamp(-20 + (i % 20)),
    };
  });

  // Approve proposal actions
  addActions(SEED_COUNTS.APPROVE_PROPOSAL, "approve_proposal", (base, i) => ({
    ...base,
    predecessor_id: base.signer_account_id,
    receiver_id: VOTING_CONTRACT,
    deposit: "0",
    args_base64: generateBase64Args({
      proposal_id: i + 1,
    }),
    block_timestamp: getTimestamp(-15 + i),
  }));

  return { actions, receiptIds, methodNames };
}

async function seedReceiptActions() {
  console.log("Seeding receipt actions...");

  const { actions, receiptIds, methodNames } = createReceiptActions();

  await prisma.fastnear_receipt_actions.createMany({
    data: actions,
    skipDuplicates: true,
  });

  return { receiptIds, methodNames };
}

async function seedExecutionOutcomes(
  receiptIds: string[],
  methodNames: string[]
) {
  console.log("Seeding execution outcomes...");

  const outcomes = receiptIds.map((receiptId, i) => {
    const methodName = methodNames[i];
    const blockHeight = BASE_BLOCK_HEIGHT + BigInt(i);

    let logs = [];
    let eventData: any = {
      owner_id: faker.helpers.arrayElement(NEAR_ACCOUNTS),
      amount: faker.number
        .int({ min: 1000000000, max: 100000000000 })
        .toString(),
    };

    if (methodName === "on_lockup_update") {
      eventData = {
        account_id: faker.helpers.arrayElement(NEAR_ACCOUNTS),
        locked_near_balance: faker.number
          .int({ min: 1000000000, max: 100000000000 })
          .toString(),
      };
    } else if (methodName === "vote") {
      eventData = {
        account_balance: faker.number
          .int({ min: 1000000000, max: 100000000000 })
          .toString(),
        proposal_id: faker.number.int({ min: 1, max: 10 }).toString(),
      };
    } else if (methodName === "create_proposal") {
      eventData = {
        proposal_id: faker.number.int({ min: 1, max: 10 }).toString(),
      };
    }

    logs = [generateEventLog("ft_mint", eventData)];

    return {
      receipt_id: receiptId,
      block_height: blockHeight,
      block_hash: randomUUID(),
      chunk_hash: randomUUID(),
      shard_id: "0",
      gas_burnt: BigInt(faker.number.int({ min: 1000000, max: 10000000 })),
      gas_used: faker.number.float({ min: 1000000, max: 10000000 }),
      tokens_burnt: faker.number.float({ min: 0.001, max: 0.1 }),
      executor_account_id: faker.helpers.arrayElement(NEAR_ACCOUNTS),
      status: faker.helpers.arrayElement(["SuccessValue", "SuccessReceiptId"]),
      outcome_receipt_ids: [randomUUID()],
      executed_in_block_hash: randomUUID(),
      logs,
    };
  });

  await prisma.fastnear_execution_outcomes.createMany({
    data: outcomes,
    skipDuplicates: true,
  });
}

async function seedWeb2Data() {
  console.log("Seeding web2 data...");

  const delegateStatements: Prisma.delegate_statementsCreateManyInput[] =
    Array.from({ length: SEED_COUNTS.DELEGATE_STATEMENTS }, () => ({
      address: faker.helpers.arrayElement(NEAR_ACCOUNTS),
      signature: faker.string.alphanumeric(128),
      statement: faker.lorem.paragraphs(3),
      publicKey: faker.string.alphanumeric(88),
      message: `Delegate statement for ${faker.helpers.arrayElement(
        NEAR_ACCOUNTS
      )}`,
      topIssues: Array.from({ length: 3 }, () => ({
        type: faker.helpers.arrayElement([
          "crossChain",
          "fundingAndGrants",
          "incentivizedParticipation",
          "security",
          "houseOfStake",
        ]),
        value: faker.lorem.sentence(),
      })),
      agreeCodeConduct: true,
      twitter: faker.helpers.maybe(() => `@${faker.internet.userName()}`, {
        probability: 0.7,
      }),
      discord: faker.helpers.maybe(
        () =>
          `${faker.internet.userName()}#${faker.number.int({
            min: 1000,
            max: 9999,
          })}`,
        { probability: 0.5 }
      ),
      email: faker.helpers.maybe(() => faker.internet.email(), {
        probability: 0.6,
      }),
      warpcast: faker.helpers.maybe(() => `@${faker.internet.userName()}`, {
        probability: 0.3,
      }),
      endorsed: faker.helpers.maybe(() => true, { probability: 0.4 }),
    }));

  const cacheData: Prisma.cacheCreateManyInput[] = Array.from(
    { length: SEED_COUNTS.CACHE_ENTRIES },
    (_, i) => ({
      key: `cache_key_${i}`,
      data: {
        type: faker.helpers.arrayElement(["proposal", "vote", "delegation"]),
        value: faker.number.int({ min: 1000, max: 999999 }),
        metadata: {
          timestamp: new Date().toISOString(),
          source: faker.helpers.arrayElement(["api", "indexer", "rpc"]),
        },
      },
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    })
  );

  await prisma.delegate_statements.createMany({
    data: delegateStatements,
    skipDuplicates: true,
  });

  await prisma.cache.createMany({
    data: cacheData,
    skipDuplicates: true,
  });
}

async function main() {
  console.log("Starting database seeding...");

  try {
    await seedBlocks();
    const { receiptIds, methodNames } = await seedReceiptActions();
    await seedExecutionOutcomes(receiptIds, methodNames);
    await seedWeb2Data();

    console.log("Database seeding completed successfully!");

    const stats = await Promise.all([
      prisma.fastnear_blocks.count(),
      prisma.fastnear_receipt_actions.count(),
      prisma.fastnear_execution_outcomes.count(),
      prisma.delegate_statements.count(),
      prisma.cache.count(),
    ]);

    console.log("\nSeeding Statistics:");
    console.log(`- Blocks: ${stats[0]}`);
    console.log(`- Receipt Actions: ${stats[1]}`);
    console.log(`- Execution Outcomes: ${stats[2]}`);
    console.log(`- Delegate Statements: ${stats[3]}`);
    console.log(`- Cache Entries: ${stats[4]}`);
  } catch (error) {
    console.error("Error during seeding:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

export { main as seed };
