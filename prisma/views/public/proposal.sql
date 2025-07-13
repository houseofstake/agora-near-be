WITH execution_outcomes_prep AS (
  SELECT
    split_part(execution_outcomes.receipt_id, '-' :: text, 2) AS receipt_id,
    execution_outcomes.status,
    execution_outcomes.logs,
    execution_outcomes.results_json
  FROM
    execution_outcomes
),
receipt_actions_prep AS (
  SELECT
    decode(ra.args_base64, 'base64' :: text) AS args_decoded,
    eo.status AS action_status,
    eo.logs AS action_logs,
    eo.results_json,
    base58_encode(ra.receipt_id) AS receipt_id_encoded,
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
create_proposal AS (
  SELECT
    base58_encode(ra.receipt_id) AS id,
    base58_encode(ra.receipt_id) AS receipt_id,
    date(ra.block_timestamp) AS proposal_created_date,
    ra.block_timestamp AS proposal_created_at,
    ra.receiver_id AS hos_contract_address,
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
          ) ->> 'proposal_id' :: text
        )
      ) :: numeric
      ELSE NULL :: numeric
    END AS proposal_id,
    CASE
      WHEN (
        (
          safe_json_parse(convert_from(ra.args_decoded, 'UTF8' :: name)) ->> 'error' :: text
        ) IS NULL
      ) THEN (
        (
          safe_json_parse(convert_from(ra.args_decoded, 'UTF8' :: name)) -> 'metadata' :: text
        ) ->> 'title' :: text
      )
      ELSE NULL :: text
    END AS proposal_title,
    CASE
      WHEN (
        (
          safe_json_parse(convert_from(ra.args_decoded, 'UTF8' :: name)) ->> 'error' :: text
        ) IS NULL
      ) THEN (
        (
          safe_json_parse(convert_from(ra.args_decoded, 'UTF8' :: name)) -> 'metadata' :: text
        ) ->> 'description' :: text
      )
      ELSE NULL :: text
    END AS proposal_description,
    CASE
      WHEN (
        (
          safe_json_parse(convert_from(ra.args_decoded, 'UTF8' :: name)) ->> 'error' :: text
        ) IS NULL
      ) THEN (
        (
          safe_json_parse(convert_from(ra.args_decoded, 'UTF8' :: name)) -> 'metadata' :: text
        ) ->> 'link' :: text
      )
      ELSE NULL :: text
    END AS proposal_url,
    ra.signer_account_id AS proposal_creator_id,
    ra.action_logs,
    ra.block_height,
    base58_encode(ra.block_hash) AS block_hash
  FROM
    receipt_actions_prep ra
  WHERE
    (ra.method_name = 'create_proposal' :: text)
),
approve_proposal AS (
  SELECT
    base58_encode(ra.receipt_id) AS id,
    base58_encode(ra.receipt_id) AS receipt_id,
    CASE
      WHEN (
        (
          safe_json_parse(ra.results_json) ->> 'error' :: text
        ) IS NULL
      ) THEN base58_encode(
        (
          safe_json_parse(ra.results_json) ->> 'receipt_id' :: text
        )
      )
      ELSE NULL :: text
    END AS snapshot_receipt_id,
    date(ra.block_timestamp) AS proposal_approved_date,
    ra.block_timestamp AS proposal_approved_at,
    ra.receiver_id AS hos_contract_address,
    CASE
      WHEN (
        (
          safe_json_parse(convert_from(ra.args_decoded, 'UTF8' :: name)) ->> 'error' :: text
        ) IS NULL
      ) THEN (
        (
          safe_json_parse(convert_from(ra.args_decoded, 'UTF8' :: name)) ->> 'proposal_id' :: text
        )
      ) :: numeric
      ELSE NULL :: numeric
    END AS proposal_id,
    ra.signer_account_id AS proposal_approver_id,
    ra.action_logs
  FROM
    receipt_actions_prep ra
  WHERE
    (ra.method_name = 'approve_proposal' :: text)
),
approve_proposal_snapshot_metadata AS (
  SELECT
    ap_1.proposal_id,
    ap_1.receipt_id AS approve_proposal_receipt_id,
    ra.receipt_id_encoded AS snapshot_receipt_id,
    CASE
      WHEN (
        (
          safe_json_parse(ra.results_json) ->> 'error' :: text
        ) IS NULL
      ) THEN (
        (
          (
            safe_json_parse(ra.results_json) -> 'snapshot_and_state' :: text
          ) ->> 'total_venear' :: text
        )
      ) :: numeric
      ELSE NULL :: numeric
    END AS total_venear_amount,
    CASE
      WHEN (
        (
          safe_json_parse(ra.results_json) ->> 'error' :: text
        ) IS NULL
      ) THEN (
        (
          safe_json_parse(ra.results_json) ->> 'voting_duration_ns' :: text
        )
      ) :: numeric
      ELSE NULL :: numeric
    END AS voting_duration_ns,
    CASE
      WHEN (
        (
          safe_json_parse(ra.results_json) ->> 'error' :: text
        ) IS NULL
      ) THEN (
        (
          safe_json_parse(ra.results_json) ->> 'voting_start_time_ns' :: text
        )
      ) :: numeric
      ELSE NULL :: numeric
    END AS voting_start_time_ns,
    CASE
      WHEN (
        (
          safe_json_parse(ra.results_json) ->> 'error' :: text
        ) IS NULL
      ) THEN (
        (
          safe_json_parse(ra.results_json) ->> 'creation_time_ns' :: text
        )
      ) :: numeric
      ELSE NULL :: numeric
    END AS creation_time_ns
  FROM
    (
      receipt_actions_prep ra
      JOIN approve_proposal ap_1 ON (
        (ra.receipt_id_encoded = ap_1.snapshot_receipt_id)
      )
    )
),
reject_proposal AS (
  SELECT
    base58_encode(ra.receipt_id) AS id,
    base58_encode(ra.receipt_id) AS receipt_id,
    date(ra.block_timestamp) AS proposal_rejected_date,
    ra.block_timestamp AS proposal_rejected_at,
    ra.receiver_id AS hos_contract_address,
    CASE
      WHEN (
        (
          safe_json_parse(convert_from(ra.args_decoded, 'UTF8' :: name)) ->> 'error' :: text
        ) IS NULL
      ) THEN (
        (
          safe_json_parse(convert_from(ra.args_decoded, 'UTF8' :: name)) ->> 'proposal_id' :: text
        )
      ) :: numeric
      ELSE NULL :: numeric
    END AS proposal_id,
    ra.signer_account_id AS proposal_rejecter_id,
    ra.action_logs
  FROM
    receipt_actions_prep ra
  WHERE
    (ra.method_name = 'reject_proposal' :: text)
),
proposal_votes AS (
  SELECT
    proposal_voting_history.proposal_id,
    count(DISTINCT proposal_voting_history.voter_id) AS num_distinct_voters,
    string_agg(
      DISTINCT proposal_voting_history.voter_id,
      ', ' :: text
      ORDER BY
        proposal_voting_history.voter_id
    ) AS listagg_distinct_voters,
    sum(
      CASE
        WHEN (
          proposal_voting_history.vote_option = (0) :: numeric
        ) THEN 1
        ELSE 0
      END
    ) AS num_for_votes,
    sum(
      CASE
        WHEN (
          proposal_voting_history.vote_option = (1) :: numeric
        ) THEN 1
        ELSE 0
      END
    ) AS num_against_votes,
    sum(
      CASE
        WHEN (
          proposal_voting_history.vote_option = (2) :: numeric
        ) THEN 1
        ELSE 0
      END
    ) AS num_abstain_votes,
    sum(
      CASE
        WHEN (
          proposal_voting_history.vote_option = (0) :: numeric
        ) THEN proposal_voting_history.voting_power
        ELSE (0) :: numeric
      END
    ) AS for_voting_power,
    sum(
      CASE
        WHEN (
          proposal_voting_history.vote_option = (1) :: numeric
        ) THEN proposal_voting_history.voting_power
        ELSE (0) :: numeric
      END
    ) AS against_voting_power,
    sum(
      CASE
        WHEN (
          proposal_voting_history.vote_option = (2) :: numeric
        ) THEN proposal_voting_history.voting_power
        ELSE (0) :: numeric
      END
    ) AS abstain_voting_power
  FROM
    proposal_voting_history
  GROUP BY
    proposal_voting_history.proposal_id
)
SELECT
  cp.receipt_id AS id,
  cp.receipt_id,
  cp.proposal_id,
  cp.proposal_title,
  cp.proposal_description,
  cp.proposal_url,
  cp.hos_contract_address,
  CASE
    WHEN (ap.proposal_id IS NULL) THEN false
    ELSE TRUE
  END AS is_approved,
  CASE
    WHEN (rp.proposal_id IS NULL) THEN false
    ELSE TRUE
  END AS is_rejected,
  CASE
    WHEN (pv.num_distinct_voters IS NULL) THEN false
    ELSE TRUE
  END AS has_votes,
  COALESCE(
    (
      to_timestamp(
        ((aps.creation_time_ns / '1000000000' :: numeric)) :: double precision
      ) AT TIME ZONE 'UTC' :: text
    ),
    cp.proposal_created_at
  ) AS created_at,
  cp.proposal_creator_id AS creator_id,
  ap.proposal_approved_at AS approved_at,
  (
    to_timestamp(
      (
        (aps.voting_start_time_ns / '1000000000' :: numeric)
      ) :: double precision
    ) AT TIME ZONE 'UTC' :: text
  ) AS voting_start_at,
  ap.proposal_approver_id AS approver_id,
  rp.proposal_rejected_at AS rejected_at,
  rp.proposal_rejecter_id AS rejecter_id,
  aps.voting_duration_ns,
  aps.total_venear_amount AS total_venear_at_approval,
  pv.listagg_distinct_voters,
  COALESCE(pv.num_distinct_voters, (0) :: bigint) AS num_distinct_voters,
  COALESCE(pv.num_for_votes, (0) :: bigint) AS num_for_votes,
  COALESCE(pv.num_against_votes, (0) :: bigint) AS num_against_votes,
  COALESCE(pv.for_voting_power, (0) :: numeric) AS for_voting_power,
  COALESCE(pv.against_voting_power, (0) :: numeric) AS against_voting_power,
  COALESCE(pv.abstain_voting_power, (0) :: numeric) AS abstain_voting_power,
  cp.block_height,
  cp.block_hash
FROM
  (
    (
      (
        (
          create_proposal cp
          LEFT JOIN approve_proposal ap ON ((cp.proposal_id = ap.proposal_id))
        )
        LEFT JOIN approve_proposal_snapshot_metadata aps ON ((cp.proposal_id = aps.proposal_id))
      )
      LEFT JOIN reject_proposal rp ON ((cp.proposal_id = rp.proposal_id))
    )
    LEFT JOIN proposal_votes pv ON ((ap.proposal_id = pv.proposal_id))
  )
ORDER BY
  cp.proposal_created_at;