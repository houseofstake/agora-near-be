import { prisma } from "../..";

/**
 * Updates the endorsement status for existing delegates
 * @param addresses Array of NEAR addresses to endorse/unendorse
 * @param endorsed Endorsement status (true = endorsed, false = unendorsed)
 * @returns Number of delegates updated
 */
export async function updateDelegateEndorsements(
  addresses: string[],
  endorsed: boolean
): Promise<number> {
  const result = await prisma.delegate_statements.updateMany({
    where: {
      address: { in: addresses },
    },
    data: { endorsed },
  });

  return result.count;
}

