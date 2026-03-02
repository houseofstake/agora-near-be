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
import { ProposalVotingHistoryController } from "../controllers/proposal/votes.controller";

const router = express.Router();
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

// Top-level vote changes endpoint
router.get("/vote_changes/:proposal_id", votesController.getVoteChanges);

export { router as routes };
