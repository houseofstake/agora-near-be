import { providers } from "near-api-js";
import { getRpcUrl } from "../utils/rpc";

interface NearSocialProfile {
  name?: string;
  description?: string;
  image?: { url?: string; ipfs_cid?: string };
  tags?: Record<string, string>;
  linktree?: Record<string, string>;
}

export async function fetchNearSocialProfile(
  address: string,
  networkId: string = "mainnet",
): Promise<NearSocialProfile | null> {
  try {
    const rpcUrl = getRpcUrl({ networkId });
    const provider = new providers.JsonRpcProvider({ url: rpcUrl });
    const contractId = networkId === "mainnet" ? "social.near" : "v1.social08.testnet";

    const keys = [`${address}/profile/**`];

    const result = await provider.query({
      request_type: "call_function",
      account_id: contractId,
      method_name: "get",
      args_base64: Buffer.from(JSON.stringify({ keys })).toString("base64"),
      finality: "final",
    });

    const parsedResult = JSON.parse(
      Buffer.from((result as any).result).toString(),
    );

    if (parsedResult && parsedResult[address] && parsedResult[address].profile) {
      return parsedResult[address].profile as NearSocialProfile;
    }

    return null;
  } catch (error) {
    console.error(`Error fetching NEAR Social profile for ${address}:`, error);
    return null;
  }
}

export async function fetchNearSocialProfiles(
  addresses: string[],
  networkId: string = "mainnet",
): Promise<Record<string, NearSocialProfile>> {
  if (addresses.length === 0) return {};

  try {
    const rpcUrl = getRpcUrl({ networkId });
    const provider = new providers.JsonRpcProvider({ url: rpcUrl });
    const contractId = networkId === "mainnet" ? "social.near" : "v1.social08.testnet";

    const keys = addresses.map(address => `${address}/profile/**`);

    const result = await provider.query({
      request_type: "call_function",
      account_id: contractId,
      method_name: "get",
      args_base64: Buffer.from(JSON.stringify({ keys })).toString("base64"),
      finality: "final",
    });

    const parsedResult = JSON.parse(
      Buffer.from((result as any).result).toString(),
    );

    const profiles: Record<string, NearSocialProfile> = {};

    if (parsedResult) {
      for (const address of addresses) {
        if (parsedResult[address] && parsedResult[address].profile) {
          profiles[address] = parsedResult[address].profile as NearSocialProfile;
        }
      }
    }

    return profiles;
  } catch (error) {
    console.error(`Error fetching NEAR Social profiles for batch:`, error);
    return {};
  }
}

