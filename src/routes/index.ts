import express from "express";
import delegatesRoutes from "./delegates/delegates.routes";
import { proposalRoutes } from "./proposal/proposal.routes";
import { draftProposalRoutes } from "./proposal/draft-proposal.routes";
import { rpcRoutes } from "./rpc/rpc.routes";
import { archivalRpcRoutes } from "./rpc/archival-rpc.routes";
import { stakingRoutes } from "./staking/staking.routes";
import { nearRoutes } from "./near/near.routes";
import nonceRoutes from "./nonce/nonce.routes";
import { transactionsRoutes } from "./transactions/transactions.routes";
import apiKeysRoutes from "./api-keys/api-keys.routes";
import { DelegateChangesController } from "../controllers/delegates/delegates-changes.controller";
import { venearRoutes } from "./venear/venear.routes";
import { ProposalVotingHistoryController } from "../controllers/proposal/votes.controller";
import v1Routes from "./v1/v1.routes";

const router = express.Router();
const delegateChangesController = new DelegateChangesController();
const votesController = new ProposalVotingHistoryController();

// Define routes
router.use("/delegates", delegatesRoutes);
router.use("/proposal", proposalRoutes);
router.use("/proposal/draft", draftProposalRoutes);
router.use("/rpc", rpcRoutes);
router.use("/archival-rpc", archivalRpcRoutes);
router.use("/staking", stakingRoutes);
router.use("/near", nearRoutes);
router.use("/nonce", nonceRoutes);
router.use("/transactions", transactionsRoutes);
router.use("/api-keys", apiKeysRoutes);
router.use("/venear", venearRoutes);
router.use("/v1", v1Routes);

router.get(
  "/delegate_statement_changes",
  delegateChangesController.getDelegateStatementChanges,
);
router.get(
  "/get_voting_power_chart/:account_id",
  delegateChangesController.getVotingPowerChart,
);
// Top-level vote changes endpoint
router.get("/vote_changes/:proposal_id", votesController.getVoteChanges);

export { router as routes };
