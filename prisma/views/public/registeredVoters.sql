WITH execution_outcomes_prep AS (
  SELECT
    split_part(execution_outcomes.receipt_id, '-' :: text, 2) AS receipt_id,
    execution_outcomes.status,
    execution_outcomes.logs
  FROM
    execution_outcomes
),
receipt_actions_prep AS (
  SELECT
    decode(ra.args_base64, 'base64' :: text) AS args_decoded,
    eo.status AS action_status,
    eo.logs AS action_logs,
    ra.id,
    ra.block_height,
    ra.receipt_id,
    ra.signer_account_id,
    ra.signer_public_key,
    ra.gas_price,
    ra.action_kind,
    ra.predecessor_id,
    ra.receiver_id,
    ra.block_hash,
    ra.chunk_hash,
    ra.author,
    ra.method_name,
    ra.gas,
    ra.deposit,
    ra.args_base64,
    ra.args_json,
    ra.action_index,
    ra.block_timestamp
  FROM
    (
      receipt_actions ra
      JOIN execution_outcomes_prep eo ON (
        (
          (ra.receipt_id = eo.receipt_id)
          AND (
            eo.status = ANY (
              ARRAY ['SuccessReceiptId'::text, 'SuccessValue'::text]
            )
          )
        )
      )
    )
  WHERE
    (
      (ra.action_kind = 'FunctionCall' :: text)
      AND (
        ra.receiver_id = ANY (
          ARRAY ['v.r-1748895584.testnet'::text, 'vote.r-1748895584.testnet'::text]
        )
      )
    )
),
registered_voters_prep AS (
  SELECT
    decode(ra.args_base64, 'base64' :: text) AS args,
    ra.args_decoded,
    ra.action_status,
    ra.action_logs,
    ra.id,
    ra.block_height,
    ra.receipt_id,
    ra.signer_account_id,
    ra.signer_public_key,
    ra.gas_price,
    ra.action_kind,
    ra.predecessor_id,
    ra.receiver_id,
    ra.block_hash,
    ra.chunk_hash,
    ra.author,
    ra.method_name,
    ra.gas,
    ra.deposit,
    ra.args_base64,
    ra.args_json,
    ra.action_index,
    ra.block_timestamp
  FROM
    receipt_actions_prep ra
  WHERE
    (ra.method_name = 'deploy_lockup' :: text)
),
initial_voting_power_from_locks_unlocks AS (
  SELECT
    ra.block_timestamp,
    ra.args_decoded,
    base58_encode(ra.receipt_id) AS receipt_id,
    COALESCE(
      CASE
        WHEN (
          (
            safe_json_parse(
              REPLACE(ra.action_logs [1], 'EVENT_JSON:' :: text, '' :: text)
            ) ->> 'error' :: text
          ) IS NULL
        ) THEN (
          (
            (
              safe_json_parse(
                REPLACE(ra.action_logs [1], 'EVENT_JSON:' :: text, '' :: text)
              ) -> 'data' :: text
            ) -> 0
          ) ->> 'owner_id' :: text
        )
        ELSE NULL :: text
      END,
      ra.signer_account_id
    ) AS registered_voter_id,
    CASE
      WHEN (
        (
          safe_json_parse(
            REPLACE(ra.action_logs [1], 'EVENT_JSON:' :: text, '' :: text)
          ) ->> 'error' :: text
        ) IS NULL
      ) THEN (
        (
          (
            (
              safe_json_parse(
                REPLACE(ra.action_logs [1], 'EVENT_JSON:' :: text, '' :: text)
              ) -> 'data' :: text
            ) -> 0
          ) ->> 'amount' :: text
        )
      ) :: numeric
      ELSE NULL :: numeric
    END AS initial_voting_power,
    ra.receiver_id AS hos_contract_address,
    ra.block_height,
    base58_encode(ra.block_hash) AS block_hash
  FROM
    receipt_actions_prep ra
  WHERE
    (ra.method_name = 'storage_deposit' :: text)
),
current_voting_power_from_locks_unlocks AS (
  SELECT
    ra.block_timestamp,
    base58_encode(ra.receipt_id) AS receipt_id,
    COALESCE(
      CASE
        WHEN (
          (
            safe_json_parse(
              REPLACE(ra.action_logs [1], 'EVENT_JSON:' :: text, '' :: text)
            ) ->> 'error' :: text
          ) IS NULL
        ) THEN (
          (
            (
              safe_json_parse(
                REPLACE(ra.action_logs [1], 'EVENT_JSON:' :: text, '' :: text)
              ) -> 'data' :: text
            ) -> 0
          ) ->> 'account_id' :: text
        )
        ELSE NULL :: text
      END,
      ra.signer_account_id
    ) AS registered_voter_id,
    CASE
      WHEN (
        (
          safe_json_parse(
            REPLACE(ra.action_logs [1], 'EVENT_JSON:' :: text, '' :: text)
          ) ->> 'error' :: text
        ) IS NULL
      ) THEN (
        (
          (
            (
              safe_json_parse(
                REPLACE(ra.action_logs [1], 'EVENT_JSON:' :: text, '' :: text)
              ) -> 'data' :: text
            ) -> 0
          ) ->> 'locked_near_balance' :: text
        )
      ) :: numeric
      ELSE NULL :: numeric
    END AS current_voting_power_logs,
    CASE
      WHEN (
        (
          safe_json_parse(convert_from(ra.args_decoded, 'UTF8' :: name)) ->> 'error' :: text
        ) IS NULL
      ) THEN (
        (
          (
            (
              safe_json_parse(convert_from(ra.args_decoded, 'UTF8' :: name)) -> 'update' :: text
            ) -> 'V1' :: text
          ) ->> 'locked_near_balance' :: text
        )
      ) :: numeric
      ELSE NULL :: numeric
    END AS current_voting_power_args,
    ra.receiver_id AS hos_contract_address,
    ra.block_height,
    base58_encode(ra.block_hash) AS block_hash,
    ra.action_logs,
    row_number() OVER (
      PARTITION BY ra.signer_account_id
      ORDER BY
        ra.block_timestamp DESC
    ) AS row_num
  FROM
    receipt_actions_prep ra
  WHERE
    (ra.method_name = 'on_lockup_update' :: text)
),
actively_delegating_accounts AS (
  SELECT
    DISTINCT delegation_events.delegator_id,
    delegation_events.delegatee_id,
    delegation_events.near_amount
  FROM
    delegation_events
  WHERE
    (
      (
        delegation_events.is_latest_delegator_event = TRUE
      )
      AND (
        delegation_events.delegate_method = 'delegate_all' :: text
      )
      AND (
        delegation_events.delegate_event = 'ft_mint' :: text
      )
    )
),
delegations_voting_power AS (
  SELECT
    actively_delegating_accounts.delegatee_id,
    sum(actively_delegating_accounts.near_amount) AS delegations_voting_power
  FROM
    actively_delegating_accounts
  GROUP BY
    actively_delegating_accounts.delegatee_id
),
ten_most_recently_approved_proposals AS (
  SELECT
    approved_proposals.id,
    approved_proposals.receipt_id,
    approved_proposals.proposal_approved_date,
    approved_proposals.proposal_approved_at,
    approved_proposals.hos_contract_address,
    approved_proposals.proposal_id,
    approved_proposals.proposal_approver_id,
    approved_proposals.block_hash,
    approved_proposals.block_height
  FROM
    approved_proposals
  ORDER BY
    approved_proposals.proposal_approved_at DESC
  LIMIT
    10
), registered_voter_proposal_voting_history AS (
  SELECT
    rv.signer_account_id AS registered_voter_id,
    pvh.proposal_id,
    CASE
      WHEN (t.proposal_id IS NULL) THEN 0
      ELSE 1
    END AS is_proposal_from_ten_most_recently_approved
  FROM
    (
      (
        registered_voters_prep rv
        JOIN proposal_voting_history pvh ON ((rv.signer_account_id = pvh.voter_id))
      )
      LEFT JOIN ten_most_recently_approved_proposals t ON ((t.proposal_id = pvh.proposal_id))
    )
),
proposal_participation AS (
  SELECT
    registered_voter_proposal_voting_history.registered_voter_id,
    (
      sum(
        registered_voter_proposal_voting_history.is_proposal_from_ten_most_recently_approved
      )
    ) :: numeric AS num_recently_approved_proposals_voted_on,
    (
      (
        sum(
          registered_voter_proposal_voting_history.is_proposal_from_ten_most_recently_approved
        )
      ) :: numeric / (10) :: numeric
    ) AS proposal_participation_rate
  FROM
    registered_voter_proposal_voting_history
  GROUP BY
    registered_voter_proposal_voting_history.registered_voter_id
),
final AS (
  SELECT
    md5(base58_encode(ra.receipt_id)) AS id,
    base58_encode(ra.receipt_id) AS receipt_id,
    date(ra.block_timestamp) AS registered_date,
    ra.block_timestamp AS registered_at,
    ra.signer_account_id AS registered_voter_id,
    ra.receiver_id AS hos_contract_address,
    CASE
      WHEN (cvp.row_num IS NULL) THEN false
      ELSE TRUE
    END AS has_locked_unlocked_near,
    CASE
      WHEN (ad.delegator_id IS NULL) THEN false
      ELSE TRUE
    END AS is_actively_delegating,
    COALESCE(dvp.delegations_voting_power, (0) :: numeric) AS voting_power_from_delegations,
    COALESCE(
      cvp.current_voting_power_logs,
      ivp.initial_voting_power
    ) AS voting_power_from_locks_unlocks,
    COALESCE(ivp.initial_voting_power, (0) :: numeric) AS initial_voting_power,
    pp.proposal_participation_rate,
    ra.block_height,
    base58_encode(ra.block_hash) AS block_hash
  FROM
    (
      (
        (
          (
            (
              registered_voters_prep ra
              LEFT JOIN current_voting_power_from_locks_unlocks cvp ON (
                (
                  (ra.signer_account_id = cvp.registered_voter_id)
                  AND (cvp.row_num = 1)
                )
              )
            )
            LEFT JOIN initial_voting_power_from_locks_unlocks ivp ON ((ra.signer_account_id = ivp.registered_voter_id))
          )
          LEFT JOIN proposal_participation pp ON ((pp.registered_voter_id = ra.signer_account_id))
        )
        LEFT JOIN delegations_voting_power dvp ON ((ra.signer_account_id = dvp.delegatee_id))
      )
      LEFT JOIN actively_delegating_accounts ad ON ((ra.signer_account_id = ad.delegator_id))
    )
  WHERE
    (
      COALESCE(cvp.row_num, (0) :: bigint) = ANY (ARRAY [(0)::bigint, (1)::bigint])
    )
  ORDER BY
    ra.block_timestamp DESC
)
SELECT
  id,
  receipt_id,
  registered_date,
  registered_at,
  registered_voter_id,
  hos_contract_address,
  has_locked_unlocked_near,
  is_actively_delegating,
  voting_power_from_delegations,
  voting_power_from_locks_unlocks,
  initial_voting_power,
  CASE
    WHEN (is_actively_delegating = TRUE) THEN voting_power_from_delegations
    WHEN (is_actively_delegating = false) THEN (
      (
        initial_voting_power + voting_power_from_delegations
      ) + voting_power_from_locks_unlocks
    )
    ELSE (0) :: numeric
  END AS current_voting_power,
  proposal_participation_rate,
  block_height,
  block_hash
FROM
  final;