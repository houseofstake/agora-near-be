CREATE MATERIALIZED VIEW web2.delegate_aggregates AS
WITH last_votes AS (
  SELECT voter_id, MAX(voted_at) as last_vote_at
  FROM fastnear.proposal_voting_history
  GROUP BY voter_id
),
last_delegations AS (
  SELECT delegatee_id, MAX(event_timestamp) as last_delegation_at
  FROM fastnear.delegation_events
  WHERE delegate_event = 'ft_mint' AND is_latest_delegator_event = true
  GROUP BY delegatee_id
),
proposal_outcomes AS (
  SELECT proposal_id,
    CASE
      WHEN for_voting_power >= against_voting_power
        AND for_voting_power >= COALESCE(abstain_voting_power, 0) THEN 0
      WHEN against_voting_power > for_voting_power
        AND against_voting_power >= COALESCE(abstain_voting_power, 0) THEN 1
      ELSE 2
    END as winning_option
  FROM fastnear.proposals
  WHERE has_votes = true
),
herd_alignment AS (
  SELECT pvh.voter_id,
    COUNT(*) FILTER (WHERE pvh.vote_option = po.winning_option)::float
      / NULLIF(COUNT(*), 0) as alignment_rate
  FROM fastnear.proposal_voting_history pvh
  JOIN proposal_outcomes po ON pvh.proposal_id = po.proposal_id
  GROUP BY pvh.voter_id
)
SELECT
  COALESCE(rv.registered_voter_id, ds.address) as address,
  lv.last_vote_at as "lastVoteAt",
  ld.last_delegation_at as "lastDelegationAt",
  ha.alignment_rate as "herdAlignmentRate"
FROM fastnear.registered_voters rv
FULL OUTER JOIN web2.delegate_statements ds ON rv.registered_voter_id = ds.address
LEFT JOIN last_votes lv ON lv.voter_id = COALESCE(rv.registered_voter_id, ds.address)
LEFT JOIN last_delegations ld ON ld.delegatee_id = COALESCE(rv.registered_voter_id, ds.address)
LEFT JOIN herd_alignment ha ON ha.voter_id = COALESCE(rv.registered_voter_id, ds.address);

CREATE UNIQUE INDEX delegate_aggregates_address_idx ON web2.delegate_aggregates (address);
