CREATE VIEW public.approved_proposals AS
WITH execution_outcomes_prep AS (
	SELECT
		SPLIT_PART(receipt_id, '-', 2) AS receipt_id
		, status
		, logs
	FROM execution_outcomes
)
, approve_proposal_action_prep AS (
 	SELECT
    	decode(ra.args_base64, 'base64') AS args
    	, eo.status
    	, eo.logs
    	, ra.receipt_id AS encoded_receipt_id
    	, ra.*
  	FROM receipt_actions AS ra
  	INNER JOIN execution_outcomes_prep AS eo
 		ON ra.receipt_id = eo.receipt_id
	 	AND eo.status = 'SuccessReceiptId'
  	WHERE
    	ra.action_kind = 'FunctionCall'
    	AND ra.method_name = 'approve_proposal'
    	AND ra.receiver_id IN (           --House of Stake contracts
 			'v.r-1748895584.testnet'      --veNEAR contract 
 			, 'vote.r-1748895584.testnet' --Voting contract 
 			)
  	ORDER BY block_height DESC
 )
 SELECT
 	ra.receipt_id AS id
 	, ra.receipt_id AS receipt_id
 	, DATE(ra.block_timestamp)     AS proposal_approved_date
 	, ra.block_timestamp           AS proposal_approved_at

 	--Proposal Details
 	, ra.receiver_id           												   AS hos_contract_address
 	, (convert_from(ra.args, 'UTF8')::json->>'proposal_id')::numeric           AS proposal_id
 	, ra.signer_account_id     												   AS proposal_approver_id

 	--Block details
 	, ra.block_hash
 	, ra.block_height
 FROM approve_proposal_action_prep AS ra
 ORDER BY block_timestamp DESC
 ;

 /*
 Primary key on this table is the receipt_id (base58 encoded) + delegatee_id associated with the most recent unique delegate_all or undelegate action per delegator_id. 
 This is a dimensional table that returns, for each unique delegate_all / undelegate event, the following: 
 
 1. Timestamp / date of the delegate/undelegate action 
 2. House of Stake contract address 
 3. Delegate Method Type (one of delegate_all or undelegate)
 4. Delegation Event Type (one of ft_burn or ft_mint) 
 5. Boolean indicating whether or not a given delegate_all or undelegate event per delegator_id was the most recent (is_latest_delegator_event)
 6. Delegator ID (the user performing the NEAR delegation) 
 7. Delegatee ID (the users who are receiving the delegated NEAR; only populated when delegate_method = 'delegate_all') 
 8. Owner ID (For ft_mint events, this is the user who is receiving the delegated NEAR; for ft_burn events, this is the user who is burning/delegating away the delegated NEAR)
 9. The amount of near that was delegated 
 10. The block-related data for the delegate_all or undelegate event (block hash/id, block height) 
 */

CREATE VIEW public.delegation_events AS 
WITH execution_outcomes_prep AS (
	SELECT
 		SPLIT_PART(receipt_id, '-', 2) AS receipt_id
 		, status
 		, logs
 	FROM execution_outcomes 
)
, receipt_actions_prep AS (
	SELECT
 		decode(ra.args_base64, 'base64') AS args
 		, eo.status 					 
 		, eo.logs 						 
 		, ra.*
 	FROM receipt_actions AS ra
 	INNER JOIN execution_outcomes_prep AS eo
 		ON ra.receipt_id = eo.receipt_id
 		AND eo.status IN ('SuccessReceiptId', 'SuccessValue')
 	WHERE
 		ra.action_kind = 'FunctionCall'
 		AND ra.receiver_id IN (           --House of Stake contracts
 			'v.r-1748895584.testnet'      --veNEAR contract 
 			, 'vote.r-1748895584.testnet' --Voting contract 
 			)
)
, delegate_undelegate_events AS (
	SELECT 
		ra.*
		, ROW_NUMBER() OVER (PARTITION BY ra.predecessor_id ORDER BY ra.block_timestamp DESC) AS row_num 
	FROM receipt_actions_prep AS ra
	WHERE 
		ra.method_name IN ('delegate_all', 'undelegate')
)
SELECT
	MD5(CONCAT(ra.receipt_id, '_',  	
 		REPLACE(unnested_logs, 'EVENT_JSON:', '')::json->'data'->0->>'owner_id')) AS id 
 	    , ra.receipt_id AS receipt_id
 	, DATE(ra.block_timestamp) AS event_date
 	, ra.block_timestamp AS event_timestamp
 	, ra.receiver_id AS hos_contract_address 
 	, ra.predecessor_id AS delegator_id 
 	, (CONVERT_FROM(ra.args, 'UTF8')::json->>'receiver_id') AS delegatee_id --null for the undelegate event 
 	, ra.method_name AS delegate_method
	, REPLACE(unnested_logs, 'EVENT_JSON:', '')::json->>'event' AS delegate_event 
	, CASE 
 	 	WHEN row_num = 1 
 	 	THEN TRUE 
 	 	ELSE FALSE END AS is_latest_delegator_event 
	, REPLACE(unnested_logs, 'EVENT_JSON:', '')::json->'data'->0->>'owner_id' AS owner_id
	, (REPLACE(unnested_logs, 'EVENT_JSON:', '')::json->'data'->0->>'amount')::NUMERIC AS near_amount
		
	--Block Data 
	, ra.block_height
 	, ra.block_hash AS block_hash
 FROM delegate_undelegate_events AS ra
 LEFT JOIN LATERAL UNNEST(ra.logs) AS unnested_logs 
 	ON TRUE
 ORDER BY ra.block_timestamp DESC
;

/*
 Primary key on this table is receipt_id, with base58 encoding. 
 Every single row in this table is a unique, successful vote action.
 ("Successful" is defined by pulling only receipt_ids flagged as successful from the execution_outcomes table.)
 
 Each vote action is associated with: 
   1. A voter account 
   2. The proposal voted on 
   3. The vote option made 
   4. The voting power of the voter at the time the vote was executed (from execution_outcomes.logs)
   5. The voting power delegated on a vote action 
   6. The timestamp at which the vote action occurred 
   7. The block-related data for this vote (block hash/id, block height) 
*/

CREATE VIEW public.proposal_voting_history AS
WITH execution_outcomes_prep AS (
	SELECT 
		SPLIT_PART(receipt_id, '-', 2) AS receipt_id 
		, status
		, logs
	FROM execution_outcomes 
)
, receipt_actions_prep AS (
  	SELECT 
    	decode(ra.args_base64, 'base64') AS args
    	, ra.*
    	, eo.logs 
  	FROM receipt_actions AS ra
  	INNER JOIN execution_outcomes_prep AS eo 
 		ON ra.receipt_id = eo.receipt_id 
 		AND eo.status = 'SuccessValue'
  	WHERE 
    	ra.action_kind = 'FunctionCall'
    	AND ra.receiver_id IN (           --House of Stake contracts
 			'v.r-1748895584.testnet'      --veNEAR contract 
 			, 'vote.r-1748895584.testnet' --Voting contract 
 			) 
)
, proposal_metadata AS (
	SELECT 
		(convert_from(ra.args, 'UTF8')::json->'metadata'->>'title') AS proposal_name
		, (REPLACE(ra.logs[1], 'EVENT_JSON:', '')::json->'data'->0->>'proposal_id')::NUMERIC AS proposal_id 
	FROM receipt_actions_prep AS ra
	WHERE 
		ra.method_name = 'create_proposal'
)
, proposal_voting_history AS (
	SELECT 
		ra.receipt_id AS id  
		, ra.receipt_id AS receipt_id 
		, DATE(ra.block_timestamp)     AS voted_date 
		, ra.block_timestamp           AS voted_at 
	
		--IDs 																					
		, (convert_from(ra.args, 'UTF8')::json->>'proposal_id')::NUMERIC AS proposal_id
		, ra.receiver_id    											 AS hos_contract_address 
		, ra.predecessor_id 											 AS voter_id 
	
		/* Voter Data Per Proposal */
		--Votes Info
		, (convert_from(ra.args, 'UTF8')::json->>'vote')::NUMERIC                                				AS vote_option
		, (REPLACE(ra.logs[1], 'EVENT_JSON:', '')::json->'data'->0->>'account_balance')::NUMERIC 			    AS voting_power
		, (convert_from(ra.args, 'UTF8')::json->'v_account'->'V0'->'balance'->>'near_balance')::NUMERIC         AS near_balance 
		, (convert_from(ra.args, 'UTF8')::json->'v_account'->'V0'->'balance'->>'extra_venear_balance')::NUMERIC AS extra_venear_balance
	
    	--Delegation Info
		, (convert_from(ra.args, 'UTF8')::json->'v_account'->'V0'->'delegation'->>'account_id')        					  AS delegator_account_id 
		, (convert_from(ra.args, 'UTF8')::json->'v_account'->'V0'->'delegated_balance'->>'near_balance')::NUMERIC         AS delegated_near_balance
		, (convert_from(ra.args, 'UTF8')::json->'v_account'->'V0'->'delegated_balance'->>'extra_venear_balance')::NUMERIC AS delegated_extra_venear_balance
	
		--Logs 
		, ra.logs
	
		--Block Data 
		, ra.block_height 
		, ra.block_hash AS block_hash 
	FROM receipt_actions_prep AS ra
 	WHERE 
		ra.method_name = 'vote'
		AND (convert_from(ra.args, 'UTF8')::json->>'proposal_id')::NUMERIC IS NOT NULL
	ORDER BY proposal_id ASC, voted_at ASC 
)
, latest_vote_per_proposal_and_voter AS (
	SELECT 
		*
		, ROW_NUMBER() OVER (PARTITION BY proposal_id, voter_id ORDER BY voted_at DESC) as row_num 
	FROM proposal_voting_history 
)
SELECT 
	l.id 
	, l.receipt_id 
	, l.voted_date 
	, l.voted_at 
	, l.proposal_id 
	, pm.proposal_name
	, l.hos_contract_address 
	, l.voter_id 
	, l.vote_option 
	, l.voting_power 
	, l.near_balance 
	, l.extra_venear_balance 
	, l.delegator_account_id 
	, l.delegated_near_balance 
	, l.delegated_extra_venear_balance 
	, l.block_height 
	, l.block_hash
FROM latest_vote_per_proposal_and_voter AS l
LEFT JOIN proposal_metadata AS pm 
	ON l.proposal_id = pm.proposal_id
WHERE 
	l.row_num = 1
;

/*
 Primary key on this table is receipt_id, with base58 encoding. 
 Every single row in this table is a unique, successful deploy_lockup action, which translates into a voter registration action.
 ("Successful" is defined by pulling only receipt_ids flagged as successful from the execution_outcomes table.)
 
 Each deploy_lockup action is associated with: 
   1. A registered voter ID                                           (The voter account; eg. lighttea2007.testnet) 
   2. The related House of Stake Contract                             (veNEAR contract address, v.r-1745564650.testnet)
   3. The timestamp at which the voter registration action occurred 
   4. The block-related data for this deploy_lockup action            (Block hash/id, block height) 
   5. The registerd voter's current voting power                      (Sourced from the execution_outcomes.logs value associated with the voter account's latest on_lockup_update event from receipt_actions)  
   6. The registered voter's initial voting power                     (Sourced from the execution_outcomes.logs value associated with the storage_deposit event that gets emitted upon vote registration) 
   7. The registered voter's proposal participation rate              (Calculated as a count of the vote_options - only considering the latest vote_option per proposal - a user makes on any of the 10 most recently approved proposals for the veNEAR contract; always a percentage out of 10)
*/

CREATE VIEW public.registered_voters AS
WITH
/* Sourcing Registered Voters */
execution_outcomes_prep AS (
	SELECT
		SPLIT_PART(receipt_id, '-', 2) AS receipt_id
		, status
		, logs
	FROM execution_outcomes
)
, receipt_actions_prep AS (
	SELECT
		decode(ra.args_base64, 'base64') AS args_decoded
		, eo.status                      AS action_status
		, eo.logs                        AS action_logs
		, ra.*
	FROM receipt_actions AS ra
	INNER JOIN execution_outcomes_prep AS eo
		ON ra.receipt_id = eo.receipt_id
		AND eo.status IN ('SuccessReceiptId', 'SuccessValue')
	WHERE
		ra.action_kind = 'FunctionCall'
		AND ra.receiver_id IN (           --House of Stake contracts
    		'v.r-1748895584.testnet'      --veNEAR contract
    		, 'vote.r-1748895584.testnet' --Voting contract
    		)
)
, registered_voters_prep AS (
  	SELECT
    	decode(ra.args_base64, 'base64') AS args
    	, ra.*
  	FROM receipt_actions_prep AS ra
  	WHERE
    	ra.method_name = 'deploy_lockup'
)

/* Sourcing Voting Power per Registered Voter */
, initial_voting_power_from_locks_unlocks AS (
  	SELECT
  		ra.block_timestamp
  		, args_decoded
    	, ra.receipt_id 																		            AS receipt_id
    	, COALESCE((REPLACE(ra.action_logs[1], 'EVENT_JSON:', '')::json->'data'->0->>'owner_id'), ra.signer_account_id) AS registered_voter_id
    	, (REPLACE(ra.action_logs[1], 'EVENT_JSON:', '')::json->'data'->0->>'amount')::NUMERIC 					        AS initial_voting_power
    	, ra.receiver_id 																				                AS hos_contract_address
    	, ra.block_height
    	, ra.block_hash AS block_hash
  	FROM receipt_actions_prep AS ra
  	WHERE
    	ra.method_name = 'storage_deposit'
)
, current_voting_power_from_locks_unlocks AS (
	SELECT
		ra.block_timestamp
		, ra.receipt_id 																	    			AS receipt_id
		, COALESCE(REPLACE(ra.action_logs[1], 'EVENT_JSON:', '')::json->'data'->0->>'account_id', ra.signer_account_id) AS registered_voter_id
		, (REPLACE(ra.action_logs[1], 'EVENT_JSON:', '')::json->'data'->0->>'locked_near_balance')::NUMERIC             AS current_voting_power_logs
    	, (convert_from(ra.args_decoded, 'UTF8')::json->'update'->'V1'->>'locked_near_balance')::NUMERIC                AS current_voting_power_args
    	, ra.receiver_id 																								AS hos_contract_address
    	, ra.block_height
    	, ra.block_hash 																					AS block_hash																				
    	, ra.action_logs
    	, ROW_NUMBER() OVER (PARTITION BY signer_account_id ORDER BY block_timestamp DESC) 				                AS row_num
  	FROM receipt_actions_prep AS ra
  	WHERE
    	ra.method_name = 'on_lockup_update'
)
, actively_delegating_accounts AS (
  --List of accounts that are actively delegating right now & the accounts to which they are delegating ALL their voting power.
  --Note: Every time you delegate, you are delegating away ALL your power by default. However, this excludes amounts that are being delegated to you simultaneously; see below cte).
  --This info is important for calculating the total voting power from delegations on any given registered voter; it's the sum of voting power from others who are actively delgating to them! 
	SELECT DISTINCT 
		delegator_id 
		, delegatee_id
		, near_amount
	FROM delegation_events 
	WHERE 
		is_latest_delegator_event = TRUE 
		AND delegate_method = 'delegate_all'
		AND delegate_event = 'ft_mint'
)
, delegations_voting_power AS ( 
  --Total voting power delegated to your account, as a registered voter 
	SELECT 
 		delegatee_id 
 		, SUM(near_amount) AS delegations_voting_power 
 	FROM actively_delegating_accounts
 	GROUP BY 1
)

/* Sourcing Proposal Participation (From the 10 most recently approved proposals) */
, ten_most_recently_approved_proposals AS (
	SELECT
		*
	FROM approved_proposals
	ORDER BY proposal_approved_at DESC
	LIMIT 10
)
, registered_voter_proposal_voting_history AS (
	SELECT 
		rv.signer_account_id AS registered_voter_id
		, pvh.proposal_id 
		, CASE 
			WHEN t.proposal_id IS NULL THEN 0 
			ELSE 1 END AS is_proposal_from_ten_most_recently_approved 
	FROM registered_voters_prep AS rv 
	INNER JOIN proposal_voting_history AS pvh 
		ON rv.signer_account_id = pvh.voter_id
	LEFT JOIN ten_most_recently_approved_proposals AS t
		ON t.proposal_id = pvh.proposal_id
)
, proposal_participation AS (
	SELECT
		registered_voter_id
		, SUM(is_proposal_from_ten_most_recently_approved)::NUMERIC      AS num_recently_approved_proposals_voted_on
		, SUM(is_proposal_from_ten_most_recently_approved)::NUMERIC / 10 AS proposal_participation_rate 
	FROM registered_voter_proposal_voting_history
	GROUP BY 1
)
, final AS (
/* Registered Voters + Current Voting Power */
	SELECT
		MD5(ra.receipt_id) AS id
 		, ra.receipt_id AS receipt_id
 		, DATE(ra.block_timestamp) 	   AS registered_date
 		, ra.block_timestamp      	   AS registered_at

 		--Deploy Lockup Details
 		, ra.signer_account_id         AS registered_voter_id
 		, ra.receiver_id       		   AS hos_contract_address
 		, CASE
	 		WHEN cvp.row_num IS NULL THEN FALSE
	 		ELSE TRUE
	 		END AS has_locked_unlocked_near
		, CASE 
 			WHEN ad.delegator_id IS NULL 
 			THEN FALSE 
 			ELSE TRUE 
 			END AS is_actively_delegating --TRUE if the latest delegation event for this account = 'delegate_all'

 		--Voting Power
		, COALESCE(dvp.delegations_voting_power, 0)                         AS voting_power_from_delegations
		, COALESCE(cvp.current_voting_power_logs, ivp.initial_voting_power) AS voting_power_from_locks_unlocks
 		, COALESCE(ivp.initial_voting_power, 0)                             AS initial_voting_power
 		, pp.proposal_participation_rate

 		--Block Details (For the deploy_lockup - aka "vote registration" - action on the veNEAR HOS contract address)
 		, ra.block_height
 		, ra.block_hash AS block_hash

	FROM registered_voters_prep AS ra 						    --Sourced from the deploy_lockup event
	LEFT JOIN current_voting_power_from_locks_unlocks AS cvp 	--Sourced from the voter's most recent on_lockup_update event
		ON ra.signer_account_id = cvp.registered_voter_id
		AND cvp.row_num = 1
	LEFT JOIN initial_voting_power_from_locks_unlocks AS ivp 	--Sourced from the voter's storage_deposit event associated with the vote registration action
		ON ra.signer_account_id = ivp.registered_voter_id
	LEFT JOIN proposal_participation AS pp
		ON pp.registered_voter_id = ra.signer_account_id
	LEFT JOIN delegations_voting_power AS dvp 
		ON ra.signer_account_id = dvp.delegatee_id
	LEFT JOIN actively_delegating_accounts AS ad 
		ON ra.signer_account_id = ad.delegator_id 
	WHERE
		COALESCE(cvp.row_num, 0) IN (0,1)
	ORDER BY ra.block_timestamp DESC
)
SELECT 
	id
	, receipt_id
	, registered_date
	, registered_at
	, registered_voter_id
	, hos_contract_address
	, has_locked_unlocked_near
	, is_actively_delegating
	, voting_power_from_delegations
	, voting_power_from_locks_unlocks
	, initial_voting_power
	, CASE 
		WHEN is_actively_delegating = TRUE THEN voting_power_from_delegations 
		WHEN is_actively_delegating = FALSE THEN initial_voting_power + voting_power_from_delegations + voting_power_from_locks_unlocks
		ELSE 0
		END AS current_voting_power
	, proposal_participation_rate
	, block_height
	, block_hash
FROM final 
;