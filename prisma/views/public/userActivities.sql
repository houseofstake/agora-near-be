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
    decode(ra.args_base64, 'base64' :: text) AS args_decoded,
    CASE
      WHEN (
        eo.status = ANY (
          ARRAY ['SuccessReceiptId'::text, 'SuccessValue'::text]
        )
      ) THEN 'succeeded' :: text
      WHEN (eo.status = 'Failure' :: text) THEN 'failed' :: text
      ELSE NULL :: text
    END AS event_status,
    eo.status,
    eo.logs,
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
      fastnear.receipt_actions ra
      LEFT JOIN execution_outcomes_prep eo ON ((ra.receipt_id = eo.receipt_id))
    )
  WHERE
    (ra.action_kind = 'FunctionCall' :: text)
),
on_lockup_deployed AS (
  SELECT
    ra.receipt_id AS id,
    ra.receipt_id,
    ra.block_timestamp AS event_timestamp,
    COALESCE(
      CASE
        WHEN (
          (
            safe_json_parse(
              REPLACE(ra.logs [1], 'EVENT_JSON:' :: text, '' :: text)
            ) ->> 'error' :: text
          ) IS NULL
        ) THEN (
          safe_json_parse(
            REPLACE(ra.logs [1], 'EVENT_JSON:' :: text, '' :: text)
          ) ->> 'event' :: text
        )
        ELSE NULL :: text
      END,
      'lockup_deployed' :: text
    ) AS event_type,
    ra.method_name,
    ra.event_status,
    ra.signer_account_id AS account_id,
    ra.predecessor_id AS hos_contract_address,
    CASE
      WHEN (
        (
          safe_json_parse(
            convert_from(
              decode(ra.args_base64, 'base64' :: text),
              'UTF8' :: name
            )
          ) ->> 'error' :: text
        ) IS NULL
      ) THEN (
        (
          safe_json_parse(
            convert_from(
              decode(ra.args_base64, 'base64' :: text),
              'UTF8' :: name
            )
          ) ->> 'lockup_deposit' :: text
        )
      ) :: numeric
      ELSE NULL :: numeric
    END AS near_amount,
    CASE
      WHEN (
        (
          safe_json_parse(
            REPLACE(ra.logs [1], 'EVENT_JSON:' :: text, '' :: text)
          ) ->> 'error' :: text
        ) IS NULL
      ) THEN (
        (
          (
            (
              safe_json_parse(
                REPLACE(ra.logs [1], 'EVENT_JSON:' :: text, '' :: text)
              ) -> 'data' :: text
            ) -> 0
          ) ->> 'locked_near_balance' :: text
        )
      ) :: numeric
      ELSE NULL :: numeric
    END AS locked_near_balance,
    ra.block_height,
    ra.block_hash
  FROM
    receipt_actions_prep ra
  WHERE
    (
      (ra.method_name = 'on_lockup_deployed' :: text)
      AND (
        ra.receiver_id = ANY (
          ARRAY ['v.r-1748895584.testnet'::text, 'vote.r-1748895584.testnet'::text]
        )
      )
    )
),
lock_near AS (
  SELECT
    ra.receipt_id AS id,
    ra.receipt_id,
    ra.block_timestamp AS event_timestamp,
    COALESCE(
      CASE
        WHEN (
          (
            safe_json_parse(
              REPLACE(ra.logs [1], 'EVENT_JSON:' :: text, '' :: text)
            ) ->> 'error' :: text
          ) IS NULL
        ) THEN (
          safe_json_parse(
            REPLACE(ra.logs [1], 'EVENT_JSON:' :: text, '' :: text)
          ) ->> 'event' :: text
        )
        ELSE NULL :: text
      END,
      'lockup_lock_near' :: text
    ) AS event_type,
    ra.method_name,
    ra.event_status,
    ra.signer_account_id AS account_id,
    SUBSTRING(
      ra.receiver_id
      FROM
        (POSITION(('.' :: text) IN (ra.receiver_id)) + 1)
    ) AS hos_contract_address,
    CASE
      WHEN (
        (
          safe_json_parse(
            convert_from(
              decode(ra.args_base64, 'base64' :: text),
              'UTF8' :: name
            )
          ) ->> 'error' :: text
        ) IS NULL
      ) THEN (
        (
          safe_json_parse(
            convert_from(
              decode(ra.args_base64, 'base64' :: text),
              'UTF8' :: name
            )
          ) ->> 'amount' :: text
        )
      ) :: numeric
      ELSE NULL :: numeric
    END AS near_amount,
    CASE
      WHEN (
        (
          safe_json_parse(
            REPLACE(ra.logs [1], 'EVENT_JSON:' :: text, '' :: text)
          ) ->> 'error' :: text
        ) IS NULL
      ) THEN (
        (
          (
            (
              safe_json_parse(
                REPLACE(ra.logs [1], 'EVENT_JSON:' :: text, '' :: text)
              ) -> 'data' :: text
            ) -> 0
          ) ->> 'locked_near_balance' :: text
        )
      ) :: numeric
      ELSE NULL :: numeric
    END AS locked_near_balance,
    ra.block_height,
    ra.block_hash
  FROM
    receipt_actions_prep ra
  WHERE
    (
      (ra.method_name = 'lock_near' :: text)
      AND (
        SUBSTRING(
          ra.receiver_id
          FROM
            (POSITION(('.' :: text) IN (ra.receiver_id)) + 1)
        ) = ANY (
          ARRAY ['v.r-1748895584.testnet'::text, 'vote.r-1748895584.testnet'::text]
        )
      )
    )
),
on_lockup_update_prep AS (
  SELECT
    ra.receipt_id AS id,
    ra.receipt_id,
    ra.block_timestamp AS event_timestamp,
    ra.method_name,
    ra.event_status,
    ra.signer_account_id AS account_id,
    ra.receiver_id AS hos_contract_address,
    ra.block_hash,
    ra.block_height,
    max(
      CASE
        WHEN (
          (
            (
              safe_json_parse(REPLACE(log.log, 'EVENT_JSON:' :: text, '' :: text)) ->> 'error' :: text
            ) IS NULL
          )
          AND (
            (
              safe_json_parse(REPLACE(log.log, 'EVENT_JSON:' :: text, '' :: text)) ->> 'event' :: text
            ) = ANY (ARRAY ['ft_mint'::text, 'ft_burn'::text])
          )
        ) THEN (
          safe_json_parse(REPLACE(log.log, 'EVENT_JSON:' :: text, '' :: text)) ->> 'event' :: text
        )
        ELSE NULL :: text
      END
    ) AS ft_event_type,
    max(
      CASE
        WHEN (
          (
            (
              safe_json_parse(REPLACE(log.log, 'EVENT_JSON:' :: text, '' :: text)) ->> 'error' :: text
            ) IS NULL
          )
          AND (
            (
              safe_json_parse(REPLACE(log.log, 'EVENT_JSON:' :: text, '' :: text)) ->> 'event' :: text
            ) = 'lockup_update' :: text
          )
        ) THEN (
          (
            (
              (
                safe_json_parse(REPLACE(log.log, 'EVENT_JSON:' :: text, '' :: text)) -> 'data' :: text
              ) -> 0
            ) ->> 'locked_near_balance' :: text
          )
        ) :: numeric
        ELSE NULL :: numeric
      END
    ) AS locked_near_balance,
    max(
      CASE
        WHEN (
          (
            (
              safe_json_parse(REPLACE(log.log, 'EVENT_JSON:' :: text, '' :: text)) ->> 'error' :: text
            ) IS NULL
          )
          AND (
            (
              safe_json_parse(REPLACE(log.log, 'EVENT_JSON:' :: text, '' :: text)) ->> 'event' :: text
            ) = ANY (ARRAY ['ft_mint'::text, 'ft_burn'::text])
          )
        ) THEN (
          (
            (
              (
                safe_json_parse(REPLACE(log.log, 'EVENT_JSON:' :: text, '' :: text)) -> 'data' :: text
              ) -> 0
            ) ->> 'amount' :: text
          )
        ) :: numeric
        ELSE NULL :: numeric
      END
    ) AS near_amount
  FROM
    (
      receipt_actions_prep ra
      CROSS JOIN LATERAL unnest(ra.logs) log(log)
    )
  WHERE
    (
      (ra.method_name = 'on_lockup_update' :: text)
      AND (
        ra.receiver_id = ANY (
          ARRAY ['v.r-1748895584.testnet'::text, 'vote.r-1748895584.testnet'::text]
        )
      )
    )
  GROUP BY
    ra.receipt_id,
    ra.receipt_id,
    ra.block_timestamp,
    ra.method_name,
    ra.event_status,
    ra.signer_account_id,
    ra.receiver_id,
    ra.block_hash,
    ra.block_height
),
on_lockup_update AS (
  SELECT
    on_lockup_update_prep.id,
    on_lockup_update_prep.receipt_id,
    on_lockup_update_prep.event_timestamp,
    COALESCE(
      (
        (on_lockup_update_prep.method_name || '_' :: text) || on_lockup_update_prep.ft_event_type
      ),
      on_lockup_update_prep.method_name
    ) AS event_type,
    on_lockup_update_prep.method_name,
    on_lockup_update_prep.event_status,
    on_lockup_update_prep.account_id,
    on_lockup_update_prep.hos_contract_address,
    on_lockup_update_prep.near_amount,
    on_lockup_update_prep.locked_near_balance,
    on_lockup_update_prep.block_height,
    on_lockup_update_prep.block_hash
  FROM
    on_lockup_update_prep
),
delegations_undelegations AS (
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
    ra.block_timestamp AS event_timestamp,
    COALESCE(
      (
        (ra.method_name || '_' :: text) || CASE
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
        END
      ),
      ra.method_name
    ) AS event_type,
    ra.method_name,
    ra.event_status,
    COALESCE(
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
      END,
      ra.signer_account_id
    ) AS account_id,
    ra.receiver_id AS hos_contract_address,
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
    NULL :: numeric AS locked_near_balance,
    ra.block_height,
    ra.block_hash
  FROM
    (
      receipt_actions_prep ra
      LEFT JOIN LATERAL unnest(ra.logs) unnested_logs(unnested_logs) ON (TRUE)
    )
  WHERE
    (
      (
        ra.method_name = ANY (ARRAY ['delegate_all'::text, 'undelegate'::text])
      )
      AND (
        ra.receiver_id = ANY (
          ARRAY ['v.r-1748895584.testnet'::text, 'vote.r-1748895584.testnet'::text]
        )
      )
    )
),
begin_unlock_near AS (
  SELECT
    ra.receipt_id AS id,
    ra.receipt_id,
    ra.block_timestamp AS event_timestamp,
    ra.method_name AS event_type,
    ra.method_name,
    ra.event_status,
    ra.signer_account_id AS account_id,
    SUBSTRING(
      ra.receiver_id
      FROM
        (POSITION(('.' :: text) IN (ra.receiver_id)) + 1)
    ) AS hos_contract_address,
    CASE
      WHEN (
        (
          safe_json_parse(
            convert_from(
              decode(ra.args_base64, 'base64' :: text),
              'UTF8' :: name
            )
          ) ->> 'error' :: text
        ) IS NULL
      ) THEN (
        (
          safe_json_parse(
            convert_from(
              decode(ra.args_base64, 'base64' :: text),
              'UTF8' :: name
            )
          ) ->> 'amount' :: text
        )
      ) :: numeric
      ELSE NULL :: numeric
    END AS near_amount,
    NULL :: numeric AS locked_near_balance,
    ra.block_height,
    ra.block_hash
  FROM
    receipt_actions_prep ra
  WHERE
    (
      (ra.method_name = 'begin_unlock_near' :: text)
      AND (
        SUBSTRING(
          ra.receiver_id
          FROM
            (POSITION(('.' :: text) IN (ra.receiver_id)) + 1)
        ) = ANY (
          ARRAY ['v.r-1748895584.testnet'::text, 'vote.r-1748895584.testnet'::text]
        )
      )
    )
),
relock_pending_near AS (
  SELECT
    ra.receipt_id AS id,
    ra.receipt_id,
    ra.block_timestamp AS event_timestamp,
    ra.method_name AS event_type,
    ra.method_name,
    ra.event_status,
    ra.signer_account_id AS account_id,
    SUBSTRING(
      ra.receiver_id
      FROM
        (POSITION(('.' :: text) IN (ra.receiver_id)) + 1)
    ) AS hos_contract_address,
    CASE
      WHEN (
        (
          safe_json_parse(
            convert_from(
              decode(ra.args_base64, 'base64' :: text),
              'UTF8' :: name
            )
          ) ->> 'error' :: text
        ) IS NULL
      ) THEN (
        (
          safe_json_parse(
            convert_from(
              decode(ra.args_base64, 'base64' :: text),
              'UTF8' :: name
            )
          ) ->> 'amount' :: text
        )
      ) :: numeric
      ELSE NULL :: numeric
    END AS near_amount,
    NULL :: numeric AS locked_near_balance,
    ra.block_height,
    ra.block_hash
  FROM
    receipt_actions_prep ra
  WHERE
    (
      (ra.method_name = 'lock_pending_near' :: text)
      AND (
        SUBSTRING(
          ra.receiver_id
          FROM
            (POSITION(('.' :: text) IN (ra.receiver_id)) + 1)
        ) = ANY (
          ARRAY ['v.r-1748895584.testnet'::text, 'vote.r-1748895584.testnet'::text]
        )
      )
    )
),
unioned_events AS (
  SELECT
    on_lockup_deployed.id,
    on_lockup_deployed.receipt_id,
    on_lockup_deployed.event_timestamp,
    on_lockup_deployed.event_type,
    on_lockup_deployed.method_name,
    on_lockup_deployed.event_status,
    on_lockup_deployed.account_id,
    on_lockup_deployed.hos_contract_address,
    on_lockup_deployed.near_amount,
    on_lockup_deployed.locked_near_balance,
    on_lockup_deployed.block_height,
    on_lockup_deployed.block_hash
  FROM
    on_lockup_deployed
  UNION
  ALL
  SELECT
    lock_near.id,
    lock_near.receipt_id,
    lock_near.event_timestamp,
    lock_near.event_type,
    lock_near.method_name,
    lock_near.event_status,
    lock_near.account_id,
    lock_near.hos_contract_address,
    lock_near.near_amount,
    lock_near.locked_near_balance,
    lock_near.block_height,
    lock_near.block_hash
  FROM
    lock_near
  UNION
  ALL
  SELECT
    on_lockup_update.id,
    on_lockup_update.receipt_id,
    on_lockup_update.event_timestamp,
    on_lockup_update.event_type,
    on_lockup_update.method_name,
    on_lockup_update.event_status,
    on_lockup_update.account_id,
    on_lockup_update.hos_contract_address,
    on_lockup_update.near_amount,
    on_lockup_update.locked_near_balance,
    on_lockup_update.block_height,
    on_lockup_update.block_hash
  FROM
    on_lockup_update
  UNION
  ALL
  SELECT
    delegations_undelegations.id,
    delegations_undelegations.receipt_id,
    delegations_undelegations.event_timestamp,
    delegations_undelegations.event_type,
    delegations_undelegations.method_name,
    delegations_undelegations.event_status,
    delegations_undelegations.account_id,
    delegations_undelegations.hos_contract_address,
    delegations_undelegations.near_amount,
    delegations_undelegations.locked_near_balance,
    delegations_undelegations.block_height,
    delegations_undelegations.block_hash
  FROM
    delegations_undelegations
  UNION
  ALL
  SELECT
    begin_unlock_near.id,
    begin_unlock_near.receipt_id,
    begin_unlock_near.event_timestamp,
    begin_unlock_near.event_type,
    begin_unlock_near.method_name,
    begin_unlock_near.event_status,
    begin_unlock_near.account_id,
    begin_unlock_near.hos_contract_address,
    begin_unlock_near.near_amount,
    begin_unlock_near.locked_near_balance,
    begin_unlock_near.block_height,
    begin_unlock_near.block_hash
  FROM
    begin_unlock_near
  UNION
  ALL
  SELECT
    relock_pending_near.id,
    relock_pending_near.receipt_id,
    relock_pending_near.event_timestamp,
    relock_pending_near.event_type,
    relock_pending_near.method_name,
    relock_pending_near.event_status,
    relock_pending_near.account_id,
    relock_pending_near.hos_contract_address,
    relock_pending_near.near_amount,
    relock_pending_near.locked_near_balance,
    relock_pending_near.block_height,
    relock_pending_near.block_hash
  FROM
    relock_pending_near
)
SELECT
  id,
  receipt_id,
  hos_contract_address,
  account_id,
  date(event_timestamp) AS event_date,
  event_timestamp,
  method_name,
  event_type,
  event_status,
  near_amount,
  locked_near_balance,
  block_height,
  block_hash
FROM
  unioned_events
ORDER BY
  account_id,
  event_timestamp;