import { Request, Response } from "express";
import { prisma } from "../../index";

const normalizeBigInt = (obj: any) => {
  return JSON.parse(
    JSON.stringify(obj, (key, value) =>
      typeof value === "bigint" ? value.toString() : value,
    ),
  );
};

export class AnalyticsController {
  /**
   * GET /api/v1/analytics/global
   * Returns ecosystem-wide delegate distribution, holistic voter participation, and multi-delegator clustering.
   */
  public async getGlobalAnalytics(req: Request, res: Response) {
    try {
      // 1) Endorsed vs Regular Delegate Distribution
      const delegateQuery: any[] = await prisma.$queryRawUnsafe(`
        WITH Delegators AS (
          SELECT 
            rv.voting_power_from_locks_unlocks,
            rv.registered_voter_id,
            (
              SELECT delegatee_id 
              FROM fastnear.delegation_events de 
              WHERE de.delegator_id = rv.registered_voter_id 
              ORDER BY block_timestamp DESC 
              LIMIT 1
            ) as current_delegatee
          FROM fastnear.registered_voters rv
          WHERE rv.is_actively_delegating = true AND rv.voting_power_from_locks_unlocks > 0
        )
        SELECT 
          COALESCE(ds.endorsed, false) AS "isEndorsed",
          COUNT(DISTINCT d.registered_voter_id) AS "uniqueAddresses",
          SUM(d.voting_power_from_locks_unlocks) AS "totalDelegatedYocto"
        FROM Delegators d
        LEFT JOIN web2.delegate_statements ds ON d.current_delegatee = ds.address
        GROUP BY COALESCE(ds.endorsed, false)
      `);

      // 1b) Self-Delegation Metrics
      const selfDelegateQuery: any[] = await prisma.$queryRawUnsafe(`
        SELECT 
          COALESCE(ds.endorsed, false) AS "isEndorsed",
          COUNT(DISTINCT rv.registered_voter_id) AS "uniqueAddresses",
          SUM(rv.voting_power_from_locks_unlocks) AS "totalDelegatedYocto"
        FROM fastnear.registered_voters rv
        LEFT JOIN web2.delegate_statements ds ON rv.registered_voter_id = ds.address
        WHERE rv.is_actively_delegating = false 
          AND rv.voting_power_from_locks_unlocks > 0
        GROUP BY COALESCE(ds.endorsed, false)
      `);

      // 2) Global Voting Activity Representation
      const votingActivityQuery: any[] = await prisma.$queryRawUnsafe(`
        SELECT 
          COALESCE(ds.endorsed, false) AS "isEndorsed",
          COUNT(DISTINCT rv.registered_voter_id) AS "activeVoters",
          SUM(GREATEST(rv.current_voting_power, CASE WHEN rv.is_actively_delegating = false THEN rv.voting_power_from_locks_unlocks ELSE 0 END)) AS "uniqueParticipatingVP"
        FROM fastnear.registered_voters rv
        LEFT JOIN web2.delegate_statements ds ON rv.registered_voter_id = ds.address
        WHERE GREATEST(rv.current_voting_power, CASE WHEN rv.is_actively_delegating = false THEN rv.voting_power_from_locks_unlocks ELSE 0 END) > 0
        GROUP BY COALESCE(ds.endorsed, false)
      `);

      // 3) Multi-delegator relational mapping
      const delegatorSwitches: any[] = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*) as "historicallySwitched"
        FROM (
          SELECT delegator_id 
          FROM fastnear.delegation_events 
          GROUP BY delegator_id 
          HAVING COUNT(DISTINCT delegatee_id) > 1
        ) sub
      `);

      const delegateReceiversQuery: any[] = await prisma.$queryRawUnsafe(`
        WITH Receivers AS (
          SELECT delegatee_id, COUNT(DISTINCT delegator_id) as delegator_count
          FROM fastnear.delegation_events 
          WHERE is_latest_delegator_event = true AND delegator_id != delegatee_id
          GROUP BY delegatee_id 
          HAVING COUNT(DISTINCT delegator_id) > 1
        )
        SELECT 
          COALESCE(ds.endorsed, false) AS "isEndorsed",
          COUNT(r.delegatee_id) AS "delegatesWithMultiple"
        FROM Receivers r
        LEFT JOIN web2.delegate_statements ds ON r.delegatee_id = ds.address
        GROUP BY COALESCE(ds.endorsed, false)
      `);

      // 4) Turnout Trend per Proposal
      const turnoutTrendQuery: any[] = await prisma.$queryRawUnsafe(`
        SELECT 
          proposal_id AS "proposalId", 
          num_distinct_voters AS "uniqueVoters",
          for_voting_power + against_voting_power + abstain_voting_power AS "totalTurnoutVp"
        FROM fastnear.proposals
        WHERE has_votes = true
        ORDER BY proposal_id ASC
      `);

      // 5) Voter Engagement Tiers
      const voterEngagementQuery: any[] = await prisma.$queryRawUnsafe(`
        SELECT 
          SUM(CASE WHEN proposal_participation_rate >= 80 THEN current_voting_power ELSE 0 END) AS "activeVp",
          SUM(CASE WHEN proposal_participation_rate >= 20 AND proposal_participation_rate < 80 THEN current_voting_power ELSE 0 END) AS "occasionalVp",
          SUM(CASE WHEN proposal_participation_rate < 20 THEN current_voting_power ELSE 0 END) AS "sleepingVp",
          SUM(CASE WHEN proposal_participation_rate >= 80 THEN 1 ELSE 0 END) AS "activeVoters",
          SUM(CASE WHEN proposal_participation_rate >= 20 AND proposal_participation_rate < 80 THEN 1 ELSE 0 END) AS "occasionalVoters",
          SUM(CASE WHEN proposal_participation_rate < 20 THEN 1 ELSE 0 END) AS "sleepingVoters"
        FROM fastnear.registered_voters
      `);

      return res.status(200).json(
        normalizeBigInt({
          delegationDistribution: delegateQuery,
          selfDelegationDistribution: selfDelegateQuery,
          votingActivity: votingActivityQuery,
          relationships: {
            historicallySwitched:
              delegatorSwitches[0]?.historicallySwitched || 0,
            receivers: delegateReceiversQuery,
          },
          governanceHealth: {
            turnoutTrend: turnoutTrendQuery,
            voterEngagement: voterEngagementQuery[0] || {},
          }
        }),
      );
    } catch (error) {
      console.error("[Analytics] Error in getGlobalAnalytics:", error);
      return res
        .status(500)
        .json({ error: "Failed to fetch global analytics" });
    }
  }

  /**
   * GET /api/v1/analytics/proposal/:proposalId
   * Returns specific voting clusters, turnout rates, and endorsement polarization on a single on-chain proposal.
   */
  public async getProposalAnalytics(req: Request, res: Response) {
    try {
      const { proposalId } = req.params;
      if (!proposalId)
        return res.status(400).json({ error: "Missing proposalId parameter." });

      const parsedProposalId = parseInt(proposalId, 10);
      if (isNaN(parsedProposalId))
        return res.status(400).json({ error: "Invalid proposalId format." });

      const proposalVotesQuery: any[] = await prisma.$queryRawUnsafe(
        `
        SELECT 
          COALESCE(ds.endorsed, false) AS "isEndorsed",
          COUNT(DISTINCT pvh.voter_id) AS "activeVoters",
          SUM(pvh.voting_power) AS "participatingVP",
          pvh.vote_option AS "voteOption"
        FROM fastnear.proposal_voting_history pvh
        LEFT JOIN web2.delegate_statements ds ON pvh.voter_id = ds.address
        WHERE pvh.proposal_id = $1
        GROUP BY pvh.vote_option, COALESCE(ds.endorsed, false)
      `,
        parsedProposalId,
      );

      return res.status(200).json(
        normalizeBigInt({
          proposalId: parsedProposalId,
          votesDistribution: proposalVotesQuery,
        }),
      );
    } catch (error) {
      console.error(
        `[Analytics] Error in getProposalAnalytics for id ${req.params?.proposalId}:`,
        error,
      );
      return res
        .status(500)
        .json({ error: "Failed to fetch proposal analytics" });
    }
  }
}
