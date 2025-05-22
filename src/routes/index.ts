import express from "express";
import delegatesRoutes from "./delegates/delegates.routes";
import { proposalRoutes } from "./proposal/proposal.routes";
import { rpcRoutes } from "./rpc/rpc.routes";
import { archivalRpcRoutes } from "./rpc/archival-rpc.routes";

const router = express.Router();

// Define routes
router.use("/delegates", delegatesRoutes);
router.use("/proposal", proposalRoutes);
router.use("/rpc", rpcRoutes);
router.use("/archival-rpc", archivalRpcRoutes);

export { router as routes };
