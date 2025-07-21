WITH execution_outcomes_prep AS (
  SELECT
    execution_outcomes.receipt_id,
    execution_outcomes.status,
    execution_outcomes.logs
  FROM
    fastnear.execution_outcomes
),
approve_proposal_action_prep AS (
  SELECT
    decode(ra_1.args_base64, 'base64' :: text) AS args,
    eo.status,
    eo.logs,
    ra_1.id,
    ra_1.block_height,
    ra_1.receipt_id,
    ra_1.signer_account_id,
    ra_1.signer_public_key,
    ra_1.gas_price,
    ra_1.action_kind,
    ra_1.predecessor_id,
    ra_1.receiver_id,
    ra_1.block_hash,
    ra_1.chunk_hash,
    ra_1.author,
    ra_1.method_name,
    ra_1.gas,
    ra_1.deposit,
    ra_1.args_base64,
    ra_1.args_json,
    ra_1.action_index,
    ra_1.block_timestamp
  FROM
    (
      fastnear.receipt_actions ra_1
      JOIN execution_outcomes_prep eo ON (
        (
          (ra_1.receipt_id = eo.receipt_id)
          AND (eo.status = 'SuccessReceiptId' :: text)
        )
      )
    )
  WHERE
    (
      (ra_1.action_kind = 'FunctionCall' :: text)
      AND (ra_1.method_name = 'approve_proposal' :: text)
      AND (
        ra_1.receiver_id = ANY (
          ARRAY ['v.r-1748895584.testnet'::text, 'vote.r-1748895584.testnet'::text]
        )
      )
    )
  ORDER BY
    ra_1.block_height DESC
)
SELECT
  receipt_id AS id,
  receipt_id,
  date(block_timestamp) AS proposal_approved_date,
  block_timestamp AS proposal_approved_at,
  receiver_id AS hos_contract_address,
  CASE
    WHEN (
      (
        safe_json_parse(convert_from(args, 'UTF8' :: name)) ->> 'error' :: text
      ) IS NULL
    ) THEN (
      (
        safe_json_parse(convert_from(args, 'UTF8' :: name)) ->> 'proposal_id' :: text
      )
    ) :: numeric
    ELSE NULL :: numeric
  END AS proposal_id,
  signer_account_id AS proposal_approver_id,
  block_hash,
  block_height
FROM
  approve_proposal_action_prep ra
ORDER BY
  block_timestamp DESC;