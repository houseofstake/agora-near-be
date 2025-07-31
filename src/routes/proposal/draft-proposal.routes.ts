import express from "express";
import { DraftProposalController } from "../../controllers/proposal/draft-proposals.controller";

const router = express.Router();
const draftProposalController = new DraftProposalController();

router.post("/", draftProposalController.createDraftProposal);

router.get("/", draftProposalController.getDraftProposals);

router.get("/:id", draftProposalController.getDraftProposalById);

router.put("/:id", draftProposalController.updateDraftProposal);

router.delete("/:id", draftProposalController.deleteDraftProposal);

export { router as draftProposalRoutes };
