import express from "express";
import delegateStatementRoutes from "./delegateStatement.routes";

const router = express.Router();

// Define routes
router.use("/delegate-statement", delegateStatementRoutes);

export { router as routes };
