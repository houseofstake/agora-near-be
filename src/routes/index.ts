import express from "express";
import delegatesRoutes from "./delegates/delegates.routes";
import { proposalRoutes } from "./proposal/proposal.routes";
import { draftProposalRoutes } from "./proposal/draft-proposal.routes";
import { rpcRoutes } from "./rpc/rpc.routes";
import { archivalRpcRoutes } from "./rpc/archival-rpc.routes";
import { stakingRoutes } from "./staking/staking.routes";
import { nearRoutes } from "./near/near.routes";
import nonceRoutes from "./nonce/nonce.routes";

const router = express.Router();

// Define routes
router.use("/delegates", delegatesRoutes);
router.use("/proposal", proposalRoutes);
router.use("/draft-proposal", draftProposalRoutes);
router.use("/rpc", rpcRoutes);
router.use("/archival-rpc", archivalRpcRoutes);
router.use("/staking", stakingRoutes);
router.use("/near", nearRoutes);
router.use("/nonce", nonceRoutes);

export { router as routes };
