WITH receipt_actions_prep AS (
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
      JOIN fastnear.execution_outcomes eo ON (
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
        ra_1.method_name = ANY (ARRAY ['delegate_all'::text, 'undelegate'::text])
      )
      AND (
        ra_1.receiver_id = ANY (ARRAY ['venear.dao'::text, 'vote.dao'::text])
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
)
SELECT
  md5(
    concat(
      receipt_id,
      '_',
      (
        SELECT
          (
            (
              (
                fastnear.safe_json_parse(REPLACE(t.l, 'EVENT_JSON:' :: text, '' :: text)) -> 'data' :: text
              ) -> 0
            ) ->> 'owner_id' :: text
          )
        FROM
          unnest(ra.logs) t(l)
        WHERE
          (
            (
              (
                fastnear.safe_json_parse(REPLACE(t.l, 'EVENT_JSON:' :: text, '' :: text)) ->> 'error' :: text
              ) IS NULL
            )
            AND (
              (
                fastnear.safe_json_parse(REPLACE(t.l, 'EVENT_JSON:' :: text, '' :: text)) ->> 'event' :: text
              ) = 'ft_mint' :: text
            )
          )
        LIMIT
          1
      )
    )
  ) AS id,
  receipt_id,
  date(block_timestamp) AS event_date,
  block_timestamp AS event_timestamp,
  receiver_id AS hos_contract_address,
  predecessor_id AS delegator_id,
  CASE
    WHEN (
      (
        fastnear.safe_json_parse(convert_from(args, 'UTF8' :: name)) ->> 'error' :: text
      ) IS NULL
    ) THEN (
      fastnear.safe_json_parse(convert_from(args, 'UTF8' :: name)) ->> 'receiver_id' :: text
    )
    ELSE NULL :: text
  END AS delegatee_id,
  method_name AS delegate_method,
  (
    SELECT
      (
        fastnear.safe_json_parse(REPLACE(t.l, 'EVENT_JSON:' :: text, '' :: text)) ->> 'event' :: text
      )
    FROM
      unnest(ra.logs) t(l)
    WHERE
      (
        (
          (
            fastnear.safe_json_parse(REPLACE(t.l, 'EVENT_JSON:' :: text, '' :: text)) ->> 'error' :: text
          ) IS NULL
        )
        AND (
          (
            fastnear.safe_json_parse(REPLACE(t.l, 'EVENT_JSON:' :: text, '' :: text)) ->> 'event' :: text
          ) = ANY (ARRAY ['ft_mint'::text, 'ft_burn'::text])
        )
      )
    LIMIT
      1
  ) AS delegate_event,
  CASE
    WHEN (row_num = 1) THEN TRUE
    ELSE false
  END AS is_latest_delegator_event,
  (
    SELECT
      (
        (
          (
            fastnear.safe_json_parse(REPLACE(t.l, 'EVENT_JSON:' :: text, '' :: text)) -> 'data' :: text
          ) -> 0
        ) ->> 'owner_id' :: text
      )
    FROM
      unnest(ra.logs) t(l)
    WHERE
      (
        (
          (
            fastnear.safe_json_parse(REPLACE(t.l, 'EVENT_JSON:' :: text, '' :: text)) ->> 'error' :: text
          ) IS NULL
        )
        AND (
          (
            fastnear.safe_json_parse(REPLACE(t.l, 'EVENT_JSON:' :: text, '' :: text)) ->> 'event' :: text
          ) = 'ft_mint' :: text
        )
      )
    LIMIT
      1
  ) AS owner_id,
  COALESCE(
    (
      SELECT
        (
          (
            (
              (
                fastnear.safe_json_parse(REPLACE(t.l, 'EVENT_JSON:' :: text, '' :: text)) -> 'data' :: text
              ) -> 0
            ) ->> 'amount' :: text
          )
        ) :: numeric AS "numeric"
      FROM
        unnest(ra.logs) t(l)
      WHERE
        (
          (
            (
              fastnear.safe_json_parse(REPLACE(t.l, 'EVENT_JSON:' :: text, '' :: text)) ->> 'error' :: text
            ) IS NULL
          )
          AND (
            (
              fastnear.safe_json_parse(REPLACE(t.l, 'EVENT_JSON:' :: text, '' :: text)) ->> 'event' :: text
            ) = 'ft_burn' :: text
          )
        )
      LIMIT
        1
    ), (
      SELECT
        (
          (
            (
              (
                fastnear.safe_json_parse(REPLACE(t.l, 'EVENT_JSON:' :: text, '' :: text)) -> 'data' :: text
              ) -> 0
            ) ->> 'amount' :: text
          )
        ) :: numeric AS "numeric"
      FROM
        unnest(ra.logs) t(l)
      WHERE
        (
          (
            (
              fastnear.safe_json_parse(REPLACE(t.l, 'EVENT_JSON:' :: text, '' :: text)) ->> 'error' :: text
            ) IS NULL
          )
          AND (
            (
              fastnear.safe_json_parse(REPLACE(t.l, 'EVENT_JSON:' :: text, '' :: text)) ->> 'event' :: text
            ) = 'ft_mint' :: text
          )
          AND (
            (
              (
                (
                  fastnear.safe_json_parse(REPLACE(t.l, 'EVENT_JSON:' :: text, '' :: text)) -> 'data' :: text
                ) -> 0
              ) ->> 'owner_id' :: text
            ) = CASE
              WHEN (
                (
                  fastnear.safe_json_parse(convert_from(ra.args, 'UTF8' :: name)) ->> 'error' :: text
                ) IS NULL
              ) THEN (
                fastnear.safe_json_parse(convert_from(ra.args, 'UTF8' :: name)) ->> 'receiver_id' :: text
              )
              ELSE NULL :: text
            END
          )
        )
      LIMIT
        1
    )
  ) AS near_amount,
  block_height,
  block_hash,
  block_timestamp
FROM
  delegate_undelegate_events ra
ORDER BY
  block_timestamp DESC;