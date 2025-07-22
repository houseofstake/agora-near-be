WITH execution_outcomes_prep AS (
  SELECT
    execution_outcomes.receipt_id,
    execution_outcomes.status,
    execution_outcomes.logs
  FROM
    fastnear.execution_outcomes
),
receipt_actions_prep AS (
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
      (ra_1.action_kind = 'FunctionCall' :: text)
      AND (
        ra_1.receiver_id = ANY (
          ARRAY ['v.r-1748895584.testnet'::text, 'vote.r-1748895584.testnet'::text]
        )
      )
    )
),
delegate_undelegate_events AS (
  SELECT
    ra_1.args,
    ra_1.status,
    ra_1.logs,
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
    ra_1.block_timestamp,
    row_number() OVER (
      PARTITION BY ra_1.predecessor_id
      ORDER BY
        ra_1.block_timestamp DESC
    ) AS row_num
  FROM
    receipt_actions_prep ra_1
  WHERE
    (
      ra_1.method_name = ANY (ARRAY ['delegate_all'::text, 'undelegate'::text])
    )
)
SELECT
  md5(
    concat(
      ra.receipt_id,
      '_',
      CASE
        WHEN (
          (
            safe_json_parse(
              REPLACE(
                unnested_logs.unnested_logs,
                'EVENT_JSON:' :: text,
                '' :: text
              )
            ) ->> 'error' :: text
          ) IS NULL
        ) THEN (
          (
            (
              safe_json_parse(
                REPLACE(
                  unnested_logs.unnested_logs,
                  'EVENT_JSON:' :: text,
                  '' :: text
                )
              ) -> 'data' :: text
            ) -> 0
          ) ->> 'owner_id' :: text
        )
        ELSE NULL :: text
      END
    )
  ) AS id,
  ra.receipt_id,
  date(ra.block_timestamp) AS event_date,
  ra.block_timestamp AS event_timestamp,
  ra.receiver_id AS hos_contract_address,
  ra.predecessor_id AS delegator_id,
  CASE
    WHEN (
      (
        safe_json_parse(convert_from(ra.args, 'UTF8' :: name)) ->> 'error' :: text
      ) IS NULL
    ) THEN (
      safe_json_parse(convert_from(ra.args, 'UTF8' :: name)) ->> 'receiver_id' :: text
    )
    ELSE NULL :: text
  END AS delegatee_id,
  ra.method_name AS delegate_method,
  CASE
    WHEN (
      (
        safe_json_parse(
          REPLACE(
            unnested_logs.unnested_logs,
            'EVENT_JSON:' :: text,
            '' :: text
          )
        ) ->> 'error' :: text
      ) IS NULL
    ) THEN (
      safe_json_parse(
        REPLACE(
          unnested_logs.unnested_logs,
          'EVENT_JSON:' :: text,
          '' :: text
        )
      ) ->> 'event' :: text
    )
    ELSE NULL :: text
  END AS delegate_event,
  CASE
    WHEN (ra.row_num = 1) THEN TRUE
    ELSE false
  END AS is_latest_delegator_event,
  CASE
    WHEN (
      (
        safe_json_parse(
          REPLACE(
            unnested_logs.unnested_logs,
            'EVENT_JSON:' :: text,
            '' :: text
          )
        ) ->> 'error' :: text
      ) IS NULL
    ) THEN (
      (
        (
          safe_json_parse(
            REPLACE(
              unnested_logs.unnested_logs,
              'EVENT_JSON:' :: text,
              '' :: text
            )
          ) -> 'data' :: text
        ) -> 0
      ) ->> 'owner_id' :: text
    )
    ELSE NULL :: text
  END AS owner_id,
  CASE
    WHEN (
      (
        safe_json_parse(
          REPLACE(
            unnested_logs.unnested_logs,
            'EVENT_JSON:' :: text,
            '' :: text
          )
        ) ->> 'error' :: text
      ) IS NULL
    ) THEN (
      (
        (
          (
            safe_json_parse(
              REPLACE(
                unnested_logs.unnested_logs,
                'EVENT_JSON:' :: text,
                '' :: text
              )
            ) -> 'data' :: text
          ) -> 0
        ) ->> 'amount' :: text
      )
    ) :: numeric
    ELSE NULL :: numeric
  END AS near_amount,
  ra.block_height,
  ra.block_hash
FROM
  (
    delegate_undelegate_events ra
    LEFT JOIN LATERAL unnest(ra.logs) unnested_logs(unnested_logs) ON (TRUE)
  )
ORDER BY
  ra.block_timestamp DESC;