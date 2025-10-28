import { updateDelegateEndorsements } from "../src/lib/delegates/delegateService";

/**
 * Legacy script - Use bulk-endorse-delegates.ts for new endorsements
 * Example usage: npx ts-node scripts/endorse-delegate.ts
 */
async function endorseDelegate(
  addresses: string[],
  endorsed: boolean
): Promise<void> {
  const successCount = await updateDelegateEndorsements(addresses, endorsed);
  console.log(
    `✅ ${endorsed ? "Endorsed" : "Unendorsed"} ${successCount}/${addresses.length} delegates`
  );
}

// Example usage:
// endorseDelegate(["alice.near", "bob.near", "charlie.near"], true);
// endorseDelegate(["alice.near", "bob.near", "charlie.near"], false);
