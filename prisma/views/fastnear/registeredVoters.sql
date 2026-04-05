WITH receipt_actions_prep AS (
  SELECT
    decode(ra_1.args_base64, 'base64' :: text) AS args_decoded,
    eo.logs AS action_logs,
    ra_1.id,
    ra_1.receipt_id,
    ra_1.receiver_id,
    ra_1.signer_account_id,
    ra_1.predecessor_id,
    ra_1.method_name,
    ra_1.block_timestamp,
    ra_1.block_height,
    ra_1.block_hash
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
        ra_1.method_name = ANY (
          ARRAY ['new'::text, 'storage_deposit'::text, 'on_lockup_update'::text, 'on_lockup_deployed'::text]
        )
      )
      AND (
        ra_1.receiver_id = ANY (ARRAY ['venear.dao'::text, 'vote.dao'::text])
      )
    )
),
venear_contract_growth_config AS (
  SELECT
    ra_1.signer_account_id AS hos_contract_address,
    CASE
      WHEN (
        (
          fastnear.safe_json_parse(convert_from(ra_1.args_decoded, 'UTF8' :: name)) ->> 'error' :: text
        ) IS NULL
      ) THEN (
        (
          (
            (
              fastnear.safe_json_parse(convert_from(ra_1.args_decoded, 'UTF8' :: name)) -> 'venear_growth_config' :: text
            ) -> 'annual_growth_rate_ns' :: text
          ) ->> 'numerator' :: text
        )
      ) :: numeric
      ELSE NULL :: numeric
    END AS growth_rate_numerator_ns,
    CASE
      WHEN (
        (
          fastnear.safe_json_parse(convert_from(ra_1.args_decoded, 'UTF8' :: name)) ->> 'error' :: text
        ) IS NULL
      ) THEN (
        (
          (
            (
              fastnear.safe_json_parse(convert_from(ra_1.args_decoded, 'UTF8' :: name)) -> 'venear_growth_config' :: text
            ) -> 'annual_growth_rate_ns' :: text
          ) ->> 'denominator' :: text
        )
      ) :: numeric
      ELSE NULL :: numeric
    END AS growth_rate_denominator_ns
  FROM
    receipt_actions_prep ra_1
  WHERE
    (ra_1.method_name = 'new' :: text)
  ORDER BY
    ra_1.signer_account_id,
    ra_1.block_timestamp,
    ra_1.receipt_id
),
registration_callbacks_by_receipt AS (
  SELECT
    ra_1.id,
    ra_1.receipt_id,
    ra_1.receiver_id,
    ra_1.predecessor_id,
    ra_1.method_name,
    ra_1.block_timestamp,
    ra_1.block_height,
    ra_1.block_hash,
    COALESCE(
      CASE
        WHEN (
          (
            fastnear.safe_json_parse(
              REPLACE(
                ra_1.action_logs [1],
                'EVENT_JSON:' :: text,
                '' :: text
              )
            ) ->> 'error' :: text
          ) IS NULL
        ) THEN (
          (
            (
              fastnear.safe_json_parse(
                REPLACE(
                  ra_1.action_logs [1],
                  'EVENT_JSON:' :: text,
                  '' :: text
                )
              ) -> 'data' :: text
            ) -> 0
          ) ->> 'account_id' :: text
        )
        ELSE NULL :: text
      END,
      CASE
        WHEN (
          (
            fastnear.safe_json_parse(convert_from(ra_1.args_decoded, 'UTF8' :: name)) ->> 'error' :: text
          ) IS NULL
        ) THEN (
          fastnear.safe_json_parse(convert_from(ra_1.args_decoded, 'UTF8' :: name)) ->> 'account_id' :: text
        )
        ELSE NULL :: text
      END
    ) AS registered_voter_id,
    (
      (
        EXTRACT(
          epoch
          FROM
            ra_1.block_timestamp
        ) * '1000000000' :: numeric
      )
    ) :: bigint AS registered_at_ns
  FROM
    receipt_actions_prep ra_1
  WHERE
    (ra_1.method_name = 'on_lockup_deployed' :: text)
),
first_registration_per_voter AS (
  SELECT
    DISTINCT ON (r.registered_voter_id) r.id,
    r.receipt_id,
    r.receiver_id,
    r.predecessor_id,
    r.method_name,
    r.block_timestamp,
    r.block_height,
    r.block_hash,
    r.registered_voter_id,
    r.registered_at_ns
  FROM
    registration_callbacks_by_receipt r
  WHERE
    (r.registered_voter_id IS NOT NULL)
  ORDER BY
    r.registered_voter_id,
    r.block_timestamp,
    r.receipt_id
),
storage_deposit_events AS (
  SELECT
    ra_1.block_timestamp,
    ra_1.receipt_id,
    COALESCE(
      CASE
        WHEN (
          (
            fastnear.safe_json_parse(
              REPLACE(
                ra_1.action_logs [1],
                'EVENT_JSON:' :: text,
                '' :: text
              )
            ) ->> 'error' :: text
          ) IS NULL
        ) THEN (
          (
            (
              fastnear.safe_json_parse(
                REPLACE(
                  ra_1.action_logs [1],
                  'EVENT_JSON:' :: text,
                  '' :: text
                )
              ) -> 'data' :: text
            ) -> 0
          ) ->> 'owner_id' :: text
        )
        ELSE NULL :: text
      END,
      CASE
        WHEN (
          (
            fastnear.safe_json_parse(convert_from(ra_1.args_decoded, 'UTF8' :: name)) ->> 'error' :: text
          ) IS NULL
        ) THEN (
          fastnear.safe_json_parse(convert_from(ra_1.args_decoded, 'UTF8' :: name)) ->> 'account_id' :: text
        )
        ELSE NULL :: text
      END
    ) AS registered_voter_id,
    CASE
      WHEN (
        (
          fastnear.safe_json_parse(
            REPLACE(
              ra_1.action_logs [1],
              'EVENT_JSON:' :: text,
              '' :: text
            )
          ) ->> 'error' :: text
        ) IS NULL
      ) THEN (
        (
          (
            (
              fastnear.safe_json_parse(
                REPLACE(
                  ra_1.action_logs [1],
                  'EVENT_JSON:' :: text,
                  '' :: text
                )
              ) -> 'data' :: text
            ) -> 0
          ) ->> 'amount' :: text
        )
      ) :: numeric
      ELSE NULL :: numeric
    END AS voting_power_from_vote_registration
  FROM
    receipt_actions_prep ra_1
  WHERE
    (ra_1.method_name = 'storage_deposit' :: text)
),
first_storage_deposit_per_voter AS (
  SELECT
    DISTINCT ON (sd.registered_voter_id) sd.registered_voter_id,
    sd.voting_power_from_vote_registration
  FROM
    storage_deposit_events sd
  WHERE
    (
      sd.voting_power_from_vote_registration IS NOT NULL
    )
  ORDER BY
    sd.registered_voter_id,
    sd.block_timestamp,
    sd.receipt_id
),
voting_power_from_locks_unlocks AS (
  SELECT
    DISTINCT ON (vplu_prep.registered_voter_id) vplu_prep.block_timestamp,
    vplu_prep.receipt_id,
    vplu_prep.registered_voter_id,
    vplu_prep.voting_power_from_locks_unlocks,
    vplu_prep.lockup_update_at_ns
  FROM
    (
      SELECT
        rap.block_timestamp,
        rap.receipt_id,
        CASE
          WHEN (
            (
              fastnear.safe_json_parse(
                REPLACE(
                  rap.action_logs [1],
                  'EVENT_JSON:' :: text,
                  '' :: text
                )
              ) ->> 'error' :: text
            ) IS NULL
          ) THEN (
            (
              (
                fastnear.safe_json_parse(
                  REPLACE(
                    rap.action_logs [1],
                    'EVENT_JSON:' :: text,
                    '' :: text
                  )
                ) -> 'data' :: text
              ) -> 0
            ) ->> 'account_id' :: text
          )
          ELSE NULL :: text
        END AS registered_voter_id,
        CASE
          WHEN (
            (
              fastnear.safe_json_parse(
                REPLACE(
                  rap.action_logs [1],
                  'EVENT_JSON:' :: text,
                  '' :: text
                )
              ) ->> 'error' :: text
            ) IS NULL
          ) THEN (
            (
              (
                (
                  fastnear.safe_json_parse(
                    REPLACE(
                      rap.action_logs [1],
                      'EVENT_JSON:' :: text,
                      '' :: text
                    )
                  ) -> 'data' :: text
                ) -> 0
              ) ->> 'locked_near_balance' :: text
            )
          ) :: numeric
          ELSE NULL :: numeric
        END AS voting_power_from_locks_unlocks,
        CASE
          WHEN (
            (
              fastnear.safe_json_parse(
                REPLACE(
                  rap.action_logs [1],
                  'EVENT_JSON:' :: text,
                  '' :: text
                )
              ) ->> 'error' :: text
            ) IS NULL
          ) THEN (
            (
              (
                (
                  fastnear.safe_json_parse(
                    REPLACE(
                      rap.action_logs [1],
                      'EVENT_JSON:' :: text,
                      '' :: text
                    )
                  ) -> 'data' :: text
                ) -> 0
              ) ->> 'timestamp' :: text
            )
          ) :: numeric
          ELSE NULL :: numeric
        END AS lockup_update_at_ns
      FROM
        receipt_actions_prep rap
      WHERE
        (rap.method_name = 'on_lockup_update' :: text)
    ) vplu_prep
  ORDER BY
    vplu_prep.registered_voter_id,
    vplu_prep.block_timestamp DESC,
    vplu_prep.receipt_id DESC
),
registered_voters_prep AS (
  SELECT
    fr.id,
    fr.receipt_id,
    fr.receiver_id,
    fr.predecessor_id,
    fr.method_name,
    fr.block_timestamp,
    fr.block_height,
    fr.block_hash,
    fr.registered_at_ns,
    fr.registered_voter_id,
    sd.voting_power_from_vote_registration AS voting_power_from_vote_registrations
  FROM
    (
      first_registration_per_voter fr
      JOIN first_storage_deposit_per_voter sd ON (
        (fr.registered_voter_id = sd.registered_voter_id)
      )
    )
),
ten_most_recently_approved_proposals AS (
  SELECT
    approved_proposals.proposal_id
  FROM
    fastnear.approved_proposals
  ORDER BY
    approved_proposals.proposal_approved_at DESC
  LIMIT
    10
), registered_voter_proposal_voting_history AS (
  SELECT
    rv.registered_voter_id,
    pvh.proposal_id,
    CASE
      WHEN (t.proposal_id IS NULL) THEN 0
      ELSE 1
    END AS is_proposal_from_ten_most_recently_approved
  FROM
    (
      (
        registered_voters_prep rv
        JOIN fastnear.proposal_voting_history pvh ON ((rv.registered_voter_id = pvh.voter_id))
      )
      LEFT JOIN ten_most_recently_approved_proposals t ON ((pvh.proposal_id = t.proposal_id))
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
latest_delegate_all_events AS (
  SELECT
    DISTINCT ON (de.delegator_id) de.delegator_id,
    de.delegatee_id
  FROM
    fastnear.delegation_events de
  WHERE
    (
      (de.is_latest_delegator_event = TRUE)
      AND (de.delegate_method = 'delegate_all' :: text)
      AND (de.delegate_event = 'ft_mint' :: text)
    )
  ORDER BY
    de.delegator_id,
    de.block_timestamp DESC,
    de.receipt_id DESC
),
table_joins AS (
  SELECT
    rv.id,
    rv.receipt_id,
    rv.receiver_id,
    rv.predecessor_id,
    rv.method_name,
    rv.block_timestamp,
    rv.block_height,
    rv.block_hash,
    rv.registered_at_ns,
    rv.registered_voter_id,
    rv.voting_power_from_vote_registrations,
    CASE
      WHEN (vplu.registered_voter_id IS NULL) THEN false
      ELSE TRUE
    END AS has_locked_unlocked_near,
    CASE
      WHEN (de.delegator_id IS NULL) THEN false
      ELSE TRUE
    END AS is_actively_delegating,
    de.delegatee_id,
    pp.proposal_participation_rate,
    gc.growth_rate_numerator_ns,
    gc.growth_rate_denominator_ns,
    (
      EXTRACT(
        epoch
        FROM
          NOW()
      ) * '1000000000' :: numeric
    ) AS now_ns,
    vplu.lockup_update_at_ns AS latest_lockup_update_at_ns,
    COALESCE(
      vplu.voting_power_from_locks_unlocks,
      (0) :: numeric
    ) AS voting_power_from_locks_unlocks,
    COALESCE(
      rv.voting_power_from_vote_registrations,
      (0) :: numeric
    ) AS voting_power_from_vote_registration,
    (
      COALESCE(
        vplu.voting_power_from_locks_unlocks,
        (0) :: numeric
      ) + COALESCE(
        rv.voting_power_from_vote_registrations,
        (0) :: numeric
      )
    ) AS principal_balance
  FROM
    (
      (
        (
          (
            registered_voters_prep rv
            LEFT JOIN venear_contract_growth_config gc ON ((rv.receiver_id = gc.hos_contract_address))
          )
          LEFT JOIN voting_power_from_locks_unlocks vplu ON (
            (
              rv.registered_voter_id = vplu.registered_voter_id
            )
          )
        )
        LEFT JOIN proposal_participation pp ON (
          (rv.registered_voter_id = pp.registered_voter_id)
        )
      )
      LEFT JOIN latest_delegate_all_events de ON ((rv.registered_voter_id = de.delegator_id))
    )
),
voting_power_from_rewards AS (
  SELECT
    tj.id,
    tj.receipt_id,
    tj.receiver_id,
    tj.predecessor_id,
    tj.method_name,
    tj.block_timestamp,
    tj.block_height,
    tj.block_hash,
    tj.registered_at_ns,
    tj.registered_voter_id,
    tj.voting_power_from_vote_registrations,
    tj.has_locked_unlocked_near,
    tj.is_actively_delegating,
    tj.delegatee_id,
    tj.proposal_participation_rate,
    tj.growth_rate_numerator_ns,
    tj.growth_rate_denominator_ns,
    tj.now_ns,
    tj.latest_lockup_update_at_ns,
    tj.voting_power_from_locks_unlocks,
    tj.voting_power_from_vote_registration,
    tj.principal_balance,
    CASE
      WHEN (tj.has_locked_unlocked_near = TRUE) THEN (
        (
          (
            floor(
              (
                tj.principal_balance / '1000000000000000000000' :: numeric
              )
            ) * '1000000000000000000000' :: numeric
          ) * (
            tj.growth_rate_numerator_ns / tj.growth_rate_denominator_ns
          )
        ) * (
          (
            floor((tj.now_ns / '1000000000' :: numeric)) * '1000000000' :: numeric
          ) - (
            floor(
              (
                tj.latest_lockup_update_at_ns / '1000000000' :: numeric
              )
            ) * '1000000000' :: numeric
          )
        )
      )
      ELSE (
        (
          (
            floor(
              (
                tj.principal_balance / '1000000000000000000000' :: numeric
              )
            ) * '1000000000000000000000' :: numeric
          ) * (
            tj.growth_rate_numerator_ns / tj.growth_rate_denominator_ns
          )
        ) * (
          (
            floor((tj.now_ns / '1000000000' :: numeric)) * '1000000000' :: numeric
          ) - (
            floor(
              (
                (tj.registered_at_ns) :: numeric / '1000000000' :: numeric
              )
            ) * '1000000000' :: numeric
          )
        )
      )
    END AS extra_venear_on_principal
  FROM
    table_joins tj
),
delegated_voting_power AS (
  SELECT
    voting_power_from_rewards.delegatee_id,
    sum(voting_power_from_rewards.principal_balance) AS delegated_balance,
    sum(
      voting_power_from_rewards.extra_venear_on_principal
    ) AS delegated_extra_venear
  FROM
    voting_power_from_rewards
  WHERE
    (
      voting_power_from_rewards.delegatee_id IS NOT NULL
    )
  GROUP BY
    voting_power_from_rewards.delegatee_id
)
SELECT
  md5(ra.receipt_id) AS id,
  ra.receipt_id,
  date(ra.block_timestamp) AS registered_date,
  ra.block_timestamp AS registered_at,
  ra.registered_voter_id,
  ra.receiver_id AS hos_contract_address,
  ra.has_locked_unlocked_near,
  ra.is_actively_delegating,
  ra.delegatee_id,
  ra.proposal_participation_rate,
  ra.voting_power_from_locks_unlocks,
  ra.voting_power_from_vote_registration AS initial_voting_power,
  ra.principal_balance,
  ra.extra_venear_on_principal,
  COALESCE(dvp.delegated_balance, (0) :: numeric) AS voting_power_from_delegations,
  COALESCE(dvp.delegated_extra_venear, (0) :: numeric) AS delegated_extra_venear,
  CASE
    WHEN (ra.is_actively_delegating = TRUE) THEN (0) :: numeric
    ELSE (
      (
        (
          COALESCE(ra.principal_balance, (0) :: numeric) + COALESCE(ra.extra_venear_on_principal, (0) :: numeric)
        ) + COALESCE(dvp.delegated_balance, (0) :: numeric)
      ) + COALESCE(dvp.delegated_extra_venear, (0) :: numeric)
    )
  END AS current_voting_power,
  ra.block_height,
  ra.block_hash
FROM
  (
    voting_power_from_rewards ra
    LEFT JOIN delegated_voting_power dvp ON ((ra.registered_voter_id = dvp.delegatee_id))
  )
ORDER BY
  ra.block_timestamp;