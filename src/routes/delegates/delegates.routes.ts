import express from "express";
import { DelegatesController } from "../../controllers/delegates/delegates.controller";

const router = express.Router();
const delegatesController = new DelegatesController();

router.post("/statement", delegatesController.createDelegateStatement);

router.get(
  "/:address/voting-history",
  delegatesController.getDelegateVotingHistory
);

router.get(
  "/:address/delegated-from",
  delegatesController.getDelegateDelegatedFrom
);

router.get(
  "/:address/delegated-to",
  delegatesController.getDelegateDelegatedTo
);

router.get(
  "/:address/hos-activity",
  delegatesController.getDelegateHosActivity
);

router.get("/:address", delegatesController.getDelegateByAddress);

router.get("/", delegatesController.getAllDelegates);

export default router;
