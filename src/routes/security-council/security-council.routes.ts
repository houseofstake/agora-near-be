import express from "express";
import { SecurityCouncilController } from "../../controllers/security-council/security-council.controller";

const router = express.Router();
const controller = new SecurityCouncilController();

router.get("/members", controller.getMembers);
router.get("/proposals", controller.getProposals);
router.get("/proposals/:proposalId", controller.getProposalById);
router.post("/proposals/:proposalId/veto", controller.submitVeto);

export { router as securityCouncilRoutes };
