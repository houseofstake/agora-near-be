import express from "express";
import delegatesRoutes from "./delegates/delegates.routes";
import { proposalRoutes } from "./proposal/proposal.routes";

const router = express.Router();

// Define routes
router.use("/delegates", delegatesRoutes);
router.use("/proposal", proposalRoutes);

export { router as routes };
