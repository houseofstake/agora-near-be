import express from "express";
import { DelegateStatementController } from "../controllers/delegateStatement.controller";

const router = express.Router();
const delegateStatementController = new DelegateStatementController();

router.get(
  "/:address",
  delegateStatementController.getDelegateStatementByAddress
);

export default router;
