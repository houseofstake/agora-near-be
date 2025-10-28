import { updateDelegateEndorsements } from "../src/lib/delegates/delegateService";

// List of NEAR addresses to endorse
const ADDRESSES_TO_ENDORSE: string[] = [
  // Add your delegate addresses here
  // "alice.near",
  // "bob.near",
  // "charlie.near",
];

async function main() {
  if (ADDRESSES_TO_ENDORSE.length === 0) {
    console.log("⚠️  No addresses provided. Add addresses to ADDRESSES_TO_ENDORSE array.");
    return;
  }

  console.log(`🚀 Endorsing ${ADDRESSES_TO_ENDORSE.length} delegates...`);
  
  const updatedCount = await updateDelegateEndorsements(ADDRESSES_TO_ENDORSE, true);
  
  console.log(`✅ Endorsed ${updatedCount} delegates`);
  
  if (updatedCount < ADDRESSES_TO_ENDORSE.length) {
    console.log(`⚠️  ${ADDRESSES_TO_ENDORSE.length - updatedCount} addresses not found (must have existing delegate statements)`);
  }
}

main()
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });

