WITH receipt_actions_prep AS (
  SELECT
    decode(ra.args_base64, 'base64' :: text) AS args,
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
    ra.block_timestamp,
    eo.logs
  FROM
    (
      fastnear.receipt_actions ra
      JOIN fastnear.execution_outcomes eo ON (
        (
          (ra.receipt_id = eo.receipt_id)
          AND (eo.status = 'SuccessValue' :: text)
        )
      )
    )
  WHERE
    (
      (ra.action_kind = 'FunctionCall' :: text)
      AND (
        ra.method_name = ANY (ARRAY ['create_proposal'::text, 'vote'::text])
      )
      AND (
        ra.receiver_id = ANY (ARRAY ['venear.dao'::text, 'vote.dao'::text])
      )
    )
),
proposal_metadata AS (
  SELECT
    CASE
      WHEN (
        (
          fastnear.safe_json_parse(convert_from(ra.args, 'UTF8' :: name)) ->> 'error' :: text
        ) IS NULL
      ) THEN (
        (
          fastnear.safe_json_parse(convert_from(ra.args, 'UTF8' :: name)) -> 'metadata' :: text
        ) ->> 'title' :: text
      )
      ELSE NULL :: text
    END AS proposal_name,
    CASE
      WHEN (
        (
          fastnear.safe_json_parse(
            REPLACE(ra.logs [1], 'EVENT_JSON:' :: text, '' :: text)
          ) ->> 'error' :: text
        ) IS NULL
      ) THEN (
        (
          (
            (
              fastnear.safe_json_parse(
                REPLACE(ra.logs [1], 'EVENT_JSON:' :: text, '' :: text)
              ) -> 'data' :: text
            ) -> 0
          ) ->> 'proposal_id' :: text
        )
      ) :: numeric
      ELSE NULL :: numeric
    END AS proposal_id
  FROM
    receipt_actions_prep ra
  WHERE
    (ra.method_name = 'create_proposal' :: text)
),
proposal_voting_history AS (
  SELECT
    ra.receipt_id AS id,
    ra.receipt_id,
    date(ra.block_timestamp) AS voted_date,
    ra.block_timestamp AS voted_at,
    CASE
      WHEN (
        (
          fastnear.safe_json_parse(convert_from(ra.args, 'UTF8' :: name)) ->> 'error' :: text
        ) IS NULL
      ) THEN (
        (
          fastnear.safe_json_parse(convert_from(ra.args, 'UTF8' :: name)) ->> 'proposal_id' :: text
        )
      ) :: numeric
      ELSE NULL :: numeric
    END AS proposal_id,
    ra.receiver_id AS hos_contract_address,
    ra.predecessor_id AS voter_id,
    CASE
      WHEN (
        (
          fastnear.safe_json_parse(convert_from(ra.args, 'UTF8' :: name)) ->> 'error' :: text
        ) IS NULL
      ) THEN (
        (
          fastnear.safe_json_parse(convert_from(ra.args, 'UTF8' :: name)) ->> 'vote' :: text
        )
      ) :: numeric
      ELSE NULL :: numeric
    END AS vote_option,
    CASE
      WHEN (
        (
          fastnear.safe_json_parse(
            REPLACE(ra.logs [1], 'EVENT_JSON:' :: text, '' :: text)
          ) ->> 'error' :: text
        ) IS NULL
      ) THEN (
        (
          (
            (
              fastnear.safe_json_parse(
                REPLACE(ra.logs [1], 'EVENT_JSON:' :: text, '' :: text)
              ) -> 'data' :: text
            ) -> 0
          ) ->> 'account_balance' :: text
        )
      ) :: numeric
      ELSE NULL :: numeric
    END AS voting_power,
    CASE
      WHEN (
        (
          fastnear.safe_json_parse(convert_from(ra.args, 'UTF8' :: name)) ->> 'error' :: text
        ) IS NULL
      ) THEN (
        (
          (
            (
              (
                fastnear.safe_json_parse(convert_from(ra.args, 'UTF8' :: name)) -> 'v_account' :: text
              ) -> 'V0' :: text
            ) -> 'balance' :: text
          ) ->> 'near_balance' :: text
        )
      ) :: numeric
      ELSE NULL :: numeric
    END AS near_balance,
    CASE
      WHEN (
        (
          fastnear.safe_json_parse(convert_from(ra.args, 'UTF8' :: name)) ->> 'error' :: text
        ) IS NULL
      ) THEN (
        (
          (
            (
              (
                fastnear.safe_json_parse(convert_from(ra.args, 'UTF8' :: name)) -> 'v_account' :: text
              ) -> 'V0' :: text
            ) -> 'balance' :: text
          ) ->> 'extra_venear_balance' :: text
        )
      ) :: numeric
      ELSE NULL :: numeric
    END AS extra_venear_balance,
    CASE
      WHEN (
        (
          fastnear.safe_json_parse(convert_from(ra.args, 'UTF8' :: name)) ->> 'error' :: text
        ) IS NULL
      ) THEN (
        (
          (
            (
              fastnear.safe_json_parse(convert_from(ra.args, 'UTF8' :: name)) -> 'v_account' :: text
            ) -> 'V0' :: text
          ) -> 'delegation' :: text
        ) ->> 'account_id' :: text
      )
      ELSE NULL :: text
    END AS delegator_account_id,
    CASE
      WHEN (
        (
          fastnear.safe_json_parse(convert_from(ra.args, 'UTF8' :: name)) ->> 'error' :: text
        ) IS NULL
      ) THEN (
        (
          (
            (
              (
                fastnear.safe_json_parse(convert_from(ra.args, 'UTF8' :: name)) -> 'v_account' :: text
              ) -> 'V0' :: text
            ) -> 'delegated_balance' :: text
          ) ->> 'near_balance' :: text
        )
      ) :: numeric
      ELSE NULL :: numeric
    END AS delegated_near_balance,
    CASE
      WHEN (
        (
          fastnear.safe_json_parse(convert_from(ra.args, 'UTF8' :: name)) ->> 'error' :: text
        ) IS NULL
      ) THEN (
        (
          (
            (
              (
                fastnear.safe_json_parse(convert_from(ra.args, 'UTF8' :: name)) -> 'v_account' :: text
              ) -> 'V0' :: text
            ) -> 'delegated_balance' :: text
          ) ->> 'extra_venear_balance' :: text
        )
      ) :: numeric
      ELSE NULL :: numeric
    END AS delegated_extra_venear_balance,
    ra.logs,
    ra.block_height,
    ra.block_hash
  FROM
    receipt_actions_prep ra
  WHERE
    (
      (ra.method_name = 'vote' :: text)
      AND (
        CASE
          WHEN (
            (
              fastnear.safe_json_parse(convert_from(ra.args, 'UTF8' :: name)) ->> 'error' :: text
            ) IS NULL
          ) THEN (
            (
              fastnear.safe_json_parse(convert_from(ra.args, 'UTF8' :: name)) ->> 'proposal_id' :: text
            )
          ) :: numeric
          ELSE NULL :: numeric
        END IS NOT NULL
      )
    )
),
latest_vote_per_proposal_and_voter AS (
  SELECT
    DISTINCT ON (
      proposal_voting_history.proposal_id,
      proposal_voting_history.voter_id
    ) proposal_voting_history.id,
    proposal_voting_history.receipt_id,
    proposal_voting_history.voted_date,
    proposal_voting_history.voted_at,
    proposal_voting_history.proposal_id,
    proposal_voting_history.hos_contract_address,
    proposal_voting_history.voter_id,
    proposal_voting_history.vote_option,
    proposal_voting_history.voting_power,
    proposal_voting_history.near_balance,
    proposal_voting_history.extra_venear_balance,
    proposal_voting_history.delegator_account_id,
    proposal_voting_history.delegated_near_balance,
    proposal_voting_history.delegated_extra_venear_balance,
    proposal_voting_history.logs,
    proposal_voting_history.block_height,
    proposal_voting_history.block_hash
  FROM
    proposal_voting_history
  ORDER BY
    proposal_voting_history.proposal_id,
    proposal_voting_history.voter_id,
    proposal_voting_history.voted_at DESC,
    proposal_voting_history.receipt_id DESC
)
SELECT
  l.id,
  l.receipt_id,
  l.voted_date,
  l.voted_at,
  l.proposal_id,
  pm.proposal_name,
  l.hos_contract_address,
  l.voter_id,
  l.vote_option,
  l.voting_power,
  l.near_balance,
  l.extra_venear_balance,
  l.delegator_account_id,
  l.delegated_near_balance,
  l.delegated_extra_venear_balance,
  l.block_height,
  l.block_hash
FROM
  (
    latest_vote_per_proposal_and_voter l
    LEFT JOIN proposal_metadata pm ON ((l.proposal_id = pm.proposal_id))
  );