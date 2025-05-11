import express from "express";
import delegateStatementRoutes from "./delegateStatement.routes";
import { proposalRoutes } from "./proposal/proposal.routes";

const router = express.Router();

// Define routes
router.use("/delegate-statement", delegateStatementRoutes);
router.use("/proposal", proposalRoutes);

export { router as routes };
