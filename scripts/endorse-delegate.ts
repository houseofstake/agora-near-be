import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function endorseDelegate(
  addresses: string[],
  endorsed: boolean
): Promise<void> {
  for (const address of addresses) {
    const updatedDelegateStatement = await prisma.delegate_statements.upsert({
      where: { address },
      update: { endorsed },
      create: {
        address,
        endorsed,
        signature: "",
        statement: "",
        publicKey: "",
        message: "",
        agreeCodeConduct: true,
      },
    });
  }

  console.log(
    `✅ ${endorsed ? "Endorsed" : "Unendorsed"} ${addresses.length} delegates`
  );
}

// Example usage:
// npx ts-node scripts/endorse-delegate.ts
// npx ts-node scripts/endorse-delegate.ts

// endorseDelegate(["alice.near", "bob.near", "charlie.near"], true);
// endorseDelegate(["alice.near", "bob.near", "charlie.near"], false);
