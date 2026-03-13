import { Prisma } from "../../generated/prisma";
import { PrismaClient } from "../../generated/prisma";
import {
  getDelegatesIndex,
  DelegateDocument,
  encodeAddressForId,
} from "./client";

interface DelegateAggregateRow {
  address: string;
  currentVotingPower: string | null;
  proposalParticipationRate: string | null;
  last_vote_at: Date | null;
  last_delegation_at: Date | null;
  alignment_rate: number | null;
  statement: string | null;
  topIssues: { type: string; value: string }[] | null;
  endorsed: boolean | null;
}

function formatTopIssuesText(
  topIssues: { type: string; value: string }[] | null
): string {
  if (!topIssues || !Array.isArray(topIssues)) return "";
  return topIssues.map((i) => `${i.type}: ${i.value}`).join(". ");
}

function extractIssueTypes(
  topIssues: { type: string; value: string }[] | null
): string[] {
  if (!topIssues || !Array.isArray(topIssues)) return [];
  return topIssues.map((i) => i.type).filter(Boolean);
}

function rowToDocument(row: DelegateAggregateRow): DelegateDocument {
  return {
    id: encodeAddressForId(row.address),
    address: row.address,
    statement: row.statement ?? null,
    topIssuesText: formatTopIssuesText(row.topIssues),
    endorsed: row.endorsed ?? false,
    issueTypes: extractIssueTypes(row.topIssues),
    votingPower: row.currentVotingPower
      ? parseFloat(row.currentVotingPower)
      : 0,
    participationRate: row.proposalParticipationRate
      ? parseFloat(row.proposalParticipationRate)
      : 0,
    lastVoteTimestamp: row.last_vote_at
      ? Math.floor(row.last_vote_at.getTime() / 1000)
      : null,
    lastDelegationTimestamp: row.last_delegation_at
      ? Math.floor(row.last_delegation_at.getTime() / 1000)
      : null,
    herdAlignmentRate: row.alignment_rate,
  };
}

const DELEGATES_AGGREGATE_QUERY = Prisma.sql`
  SELECT
    COALESCE(rv.registered_voter_id, ds.address) as address,
    COALESCE(vpc.voting_power, rv.current_voting_power) as "currentVotingPower",
    rv.proposal_participation_rate as "proposalParticipationRate",
    da."lastVoteAt" as last_vote_at,
    da."lastDelegationAt" as last_delegation_at,
    da."herdAlignmentRate" as alignment_rate,
    ds.statement,
    ds."topIssues",
    ds.endorsed
  FROM fastnear.registered_voters rv
  FULL OUTER JOIN web2.delegate_statements ds ON rv.registered_voter_id = ds.address
  LEFT JOIN web2.voting_power_cache vpc ON rv.registered_voter_id = vpc.account_id
  LEFT JOIN web2.delegate_aggregates da ON da.address = COALESCE(rv.registered_voter_id, ds.address)
`;

export async function syncAllDelegatesToMeilisearch(
  prismaClient: PrismaClient
): Promise<number> {
  const rows =
    await prismaClient.$queryRaw<DelegateAggregateRow[]>(
      DELEGATES_AGGREGATE_QUERY
    );

  const documents = rows.map(rowToDocument);

  const index = await getDelegatesIndex();
  await index.updateDocuments(documents);

  return documents.length;
}

export async function syncSingleDelegateToMeilisearch(
  prismaClient: PrismaClient,
  address: string
): Promise<void> {
  const rows = await prismaClient.$queryRaw<DelegateAggregateRow[]>(
    Prisma.sql`
      SELECT
        COALESCE(rv.registered_voter_id, ds.address) as address,
        COALESCE(vpc.voting_power, rv.current_voting_power) as "currentVotingPower",
        rv.proposal_participation_rate as "proposalParticipationRate",
        da."lastVoteAt" as last_vote_at,
        da."lastDelegationAt" as last_delegation_at,
        da."herdAlignmentRate" as alignment_rate,
        ds.statement,
        ds."topIssues",
        ds.endorsed
      FROM fastnear.registered_voters rv
      FULL OUTER JOIN web2.delegate_statements ds ON rv.registered_voter_id = ds.address
      LEFT JOIN web2.voting_power_cache vpc ON rv.registered_voter_id = vpc.account_id
      LEFT JOIN web2.delegate_aggregates da ON da.address = COALESCE(rv.registered_voter_id, ds.address)
      WHERE COALESCE(rv.registered_voter_id, ds.address) = ${address}
    `
  );

  if (rows.length === 0) return;

  const document = rowToDocument(rows[0]);
  const index = await getDelegatesIndex();
  await index.updateDocuments([document]);
}
