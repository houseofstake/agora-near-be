import { MeiliSearch, Index } from "meilisearch";

const MEILI_HOST = process.env.MEILI_HOST || "http://localhost:7700";
const MEILI_MASTER_KEY = process.env.MEILI_MASTER_KEY || "";

export const meiliClient = new MeiliSearch({
  host: MEILI_HOST,
  apiKey: MEILI_MASTER_KEY,
});

export function encodeAddressForId(address: string): string {
  return address.replace(/\./g, "__DOT__");
}

export interface DelegateDocument {
  id: string;
  address: string;
  statement: string | null;
  topIssuesText: string;
  endorsed: boolean;
  issueTypes: string[];
  votingPower: number;
  participationRate: number;
  lastVoteTimestamp: number | null;
  lastDelegationTimestamp: number | null;
  herdAlignmentRate: number | null;
}

const DELEGATES_INDEX = "delegates";

let _index: Index<DelegateDocument> | null = null;

export async function getDelegatesIndex(): Promise<Index<DelegateDocument>> {
  if (_index) return _index;

  await meiliClient.updateExperimentalFeatures({ vectorStore: true } as never);

  try {
    _index = await meiliClient.getIndex<DelegateDocument>(DELEGATES_INDEX);
  } catch {
    await meiliClient
      .createIndex(DELEGATES_INDEX, { primaryKey: "id" })
      .waitTask();
    _index = await meiliClient.getIndex<DelegateDocument>(DELEGATES_INDEX);
  }

  await configureDelegatesIndex(_index);
  return _index;
}

async function configureDelegatesIndex(
  index: Index<DelegateDocument>,
): Promise<void> {
  await index.updateSettings({
    rankingRules: [
      "sort",
      "words",
      "typo",
      "proximity",
      "attribute",
      "exactness",
    ],
    searchableAttributes: ["address", "statement", "topIssuesText"],
    sortableAttributes: [
      "votingPower",
      "lastVoteTimestamp",
      "lastDelegationTimestamp",
      "herdAlignmentRate",
      "participationRate",
    ],
    filterableAttributes: ["endorsed", "issueTypes"],
    embedders: {
      default: {
        source: "huggingFace",
        model: "sentence-transformers/all-MiniLM-L6-v2",
        documentTemplate:
          "Delegate statement: {{doc.statement}}. Top issues: {{doc.topIssuesText}}",
      },
    },
  });
}
