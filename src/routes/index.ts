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
import { DelegateChangesController } from "../controllers/delegates/delegates-changes.controller";

const router = express.Router();
const delegateChangesController = new DelegateChangesController();

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

router.get("/delegate_statement_changes", delegateChangesController.getDelegateStatementChanges);
router.get("/get_voting_power_chart/:account_id", delegateChangesController.getVotingPowerChart);

export { router as routes };
