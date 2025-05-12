import express from "express";
import { DelegatesController } from "../../controllers/delegates/delegates.controller";

const router = express.Router();
const delegatesController = new DelegatesController();

router.post("/statement", delegatesController.createDelegateStatement);

router.get("/:address", delegatesController.getDelegateByAddress);

export default router;
