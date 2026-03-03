import { Request, Response } from "express";
import { Prisma } from "../../generated/prisma";
import { prisma } from "../..";

interface DelegateChangeRecord {
  account: string;
  created: Date | null;
}

interface ChangesQuery {
  page?: string;
  offset?: string;
  lookback_days?: string;
}

interface VPChartRecord {
  block_height: bigint;
  voting_power: string;
  timestamp: Date;
}

interface AccountParams {
  account_id: string;
}

export class DelegateChangesController {
  /**
   * GET /api/delegate_statement_changes
   * Returns delegate statements with registration date, paginated.
   * Supports optional lookback_days to filter by recency.
   */
  public getDelegateStatementChanges = async (
    req: Request<{}, {}, {}, ChangesQuery>,
    res: Response
  ): Promise<void> => {
    try {
      const { offset, page, lookback_days } = req.query;
      const parsedOffset = offset ? parseInt(offset, 10) : 10;
      const parsedPage = page ? parseInt(page, 10) : 1;

      if (isNaN(parsedOffset) || parsedOffset <= 0) {
        res
          .status(400)
          .json({ error: "offset must be a positive number greater than 0" });
        return;
      }

      if (isNaN(parsedPage) || parsedPage <= 0) {
        res
          .status(400)
          .json({ error: "page must be a positive number greater than 0" });
        return;
      }

      const limit = parsedOffset;
      const pageNumber = parsedPage;

      // Only apply lookback filter if explicitly provided
      const lookbackClause = lookback_days
        ? Prisma.sql`AND ds.updated_at >= NOW() - INTERVAL '1 day' * ${parseInt(lookback_days) || 30}`
        : Prisma.empty;

      const records = await prisma.$queryRaw<DelegateChangeRecord[]>(
        Prisma.sql`
          SELECT
            ds.address AS account,
            ds.updated_at AS created
          FROM web2.delegate_statements ds
          WHERE TRUE
          ${lookbackClause}
          ORDER BY ds.updated_at DESC NULLS LAST
          LIMIT ${limit}
          OFFSET ${(pageNumber - 1) * limit}
        `
      );

      const countResult = await prisma.$queryRaw<{ count: bigint }[]>(
        Prisma.sql`
          SELECT COUNT(*) AS count
          FROM web2.delegate_statements ds
          WHERE TRUE
          ${lookbackClause}
        `
      );

      const count = Number(countResult[0]?.count ?? 0);

      const changes = records.map((r) => ({
        account: r.account,
        created: r.created,
      }));

      res.status(200).json({
        page: pageNumber,
        offset: limit,
        changes,
        count,
      });
    } catch (error) {
      console.error("Error fetching delegate statement changes:", error);
      res
        .status(500)
        .json({ error: "Failed to fetch delegate statement changes" });
    }
  };

  /**
   * GET /api/get_voting_power_chart/:account_id
   * Returns a sparse array of VP data points over time for an account.
   */
  public getVotingPowerChart = async (
    req: Request<AccountParams>,
    res: Response
  ): Promise<void> => {
    try {
      const { account_id } = req.params;

      const records = await prisma.$queryRaw<VPChartRecord[]>(
        Prisma.sql`
          WITH personal_locks AS (
            SELECT
              ra.block_height,
              ra.block_timestamp AS timestamp,
              COALESCE(
                (
                  fastnear.safe_json_parse(
                    REPLACE(eo.logs[1], 'EVENT_JSON:', '')
                  ) -> 'data' -> 0 ->> 'locked_near_balance'
                ),
                '0'
              )::numeric AS vp_delta
            FROM fastnear.receipt_actions ra
            JOIN fastnear.execution_outcomes eo
              ON ra.receipt_id = eo.receipt_id
              AND eo.status = 'SuccessValue'
            WHERE ra.method_name = 'on_lockup_update'
              AND ra.signer_account_id = ${account_id}
              AND ra.action_kind = 'FunctionCall'
          ),
          delegation_changes AS (
            SELECT
              delegator_id,
              delegatee_id,
              near_amount,
              block_height,
              event_timestamp AS timestamp,
              LAG(delegatee_id) OVER (PARTITION BY delegator_id ORDER BY event_timestamp ASC) as prev_delegatee,
              LAG(near_amount) OVER (PARTITION BY delegator_id ORDER BY event_timestamp ASC) as prev_amount
            FROM fastnear.delegation_events
            WHERE near_amount IS NOT NULL
          ),
          inbound_delegations AS (
            SELECT
              block_height,
              timestamp,
              near_amount AS vp_delta
            FROM delegation_changes
            WHERE delegatee_id = ${account_id}
          ),
          lost_delegations AS (
            SELECT
              block_height,
              timestamp,
              -prev_amount AS vp_delta
            FROM delegation_changes
            WHERE prev_delegatee = ${account_id}
              AND (delegatee_id != ${account_id} OR delegatee_id IS NULL)
          ),
          combined_events AS (
            SELECT * FROM personal_locks
            UNION ALL
            SELECT * FROM inbound_delegations
            UNION ALL
            SELECT * FROM lost_delegations
          ),
          cumulative_vp AS (
            SELECT
              block_height,
              timestamp,
              SUM(vp_delta) OVER (ORDER BY timestamp ASC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS voting_power
            FROM combined_events
          )
          SELECT
            block_height,
            timestamp,
            voting_power::text AS voting_power
          FROM cumulative_vp
          ORDER BY timestamp ASC
        `
      );

      const data = records.map((r) => ({
        block_number: Number(r.block_height),
        vp: r.voting_power,
        timestamp: r.timestamp,
      }));

      res.status(200).json(data);
    } catch (error) {
      console.error("Error fetching voting power chart:", error);
      res.status(500).json({ error: "Failed to fetch voting power chart" });
    }
  };
}
