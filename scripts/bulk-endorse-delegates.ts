import { updateDelegateEndorsements } from "../src/lib/delegates/delegateService";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// Default addresses (used if no file is provided)
const DEFAULT_ADDRESSES: string[] = [
  // Add your delegate addresses here
  // "alice.near",
  // "bob.near",
];

/**
 * Reads addresses from a file (one address per line)
 * @param filePath Path to file containing addresses
 * @returns Array of addresses
 */
function readAddressesFromFile(filePath: string): string[] {
  const absolutePath = resolve(filePath);
  
  if (!existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const content = readFileSync(absolutePath, "utf-8");
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#")); // Skip empty lines and comments
}

async function main() {
  // Parse command-line arguments
  const args = process.argv.slice(2);
  const filePathArg = args.find((arg) => arg.startsWith("--file="));
  const endorsedArg = args.find((arg) => arg.startsWith("--endorsed="));
  
  const filePath = filePathArg?.split("=")[1];
  const endorsed = endorsedArg ? endorsedArg.split("=")[1] === "true" : true;

  // Get addresses from file or default array
  let addresses: string[];
  if (filePath) {
    console.log(`📂 Reading addresses from: ${filePath}`);
    addresses = readAddressesFromFile(filePath);
  } else {
    addresses = DEFAULT_ADDRESSES;
  }

  if (addresses.length === 0) {
    console.log("⚠️  No addresses provided.");
    console.log("   Option 1: Add addresses to DEFAULT_ADDRESSES array in this script");
    console.log("   Option 2: Use --file=path/to/addresses.txt");
    return;
  }

  console.log(`🚀 ${endorsed ? "Endorsing" : "Unendorsing"} ${addresses.length} delegates...`);
  
  const updatedCount = await updateDelegateEndorsements(addresses, endorsed);
  
  console.log(`✅ ${endorsed ? "Endorsed" : "Unendorsed"} ${updatedCount} delegates`);
  
  if (updatedCount < addresses.length) {
    console.log(`⚠️  ${addresses.length - updatedCount} addresses not found (must have existing delegate statements)`);
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
