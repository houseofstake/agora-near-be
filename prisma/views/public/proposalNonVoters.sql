SELECT
  md5(
    concat(p.proposal_id, '_', rv.registered_voter_id)
  ) AS id,
  p.proposal_id,
  rv.registered_voter_id
FROM
  (
    proposals p
    CROSS JOIN registered_voters rv
  )
WHERE
  (
    NOT (
      EXISTS (
        SELECT
          1
        FROM
          proposal_voting_history h
        WHERE
          (
            (h.proposal_id = p.proposal_id)
            AND (h.voter_id = rv.registered_voter_id)
          )
      )
    )
  )
ORDER BY
  p.proposal_id,
  rv.registered_voter_id;