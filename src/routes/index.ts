import express from "express";
import delegatesRoutes from "./delegates/delegates.routes";
import { proposalRoutes } from "./proposal/proposal.routes";
import { rpcRoutes } from "./rpc/rpc.routes";
import { archivalRpcRoutes } from "./rpc/archival-rpc.routes";
import { stakingRoutes } from "./staking/staking.routes";
import { nearRoutes } from "./near/near.routes";

const router = express.Router();

// Define routes
router.use("/delegates", delegatesRoutes);
router.use("/proposal", proposalRoutes);
router.use("/rpc", rpcRoutes);
router.use("/archival-rpc", archivalRpcRoutes);
router.use("/staking", stakingRoutes);
router.use("/near", nearRoutes);

export { router as routes };
