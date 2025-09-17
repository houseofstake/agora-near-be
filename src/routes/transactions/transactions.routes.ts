import express from "express";
import { TransactionsController } from "../../controllers/transactions/transactionsController";

const router = express.Router();
const transactionsController = new TransactionsController();

router.get("/hash", transactionsController.getTransactionHash);

export { router as transactionsRoutes };
