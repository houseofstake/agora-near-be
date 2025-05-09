import express from "express";
import delegateStatementRoutes from "./delegateStatement.routes";
import proposalVotingHistoryRoutes from "./propsalVotingHistory.routes";

const router = express.Router();

// Define routes
router.use("/delegate-statement", delegateStatementRoutes);
router.use("/proposal-voting-history", proposalVotingHistoryRoutes);

export { router as routes };
