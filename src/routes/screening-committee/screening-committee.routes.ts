import express from "express";
import { ScreeningCommitteeController } from "../../controllers/screening-committee/screening-committee.controller";

const router = express.Router();
const controller = new ScreeningCommitteeController();

router.get("/members", controller.getMembers);
router.get("/proposals", controller.getProposals);
router.get("/proposals/:proposalId", controller.getProposalById);
router.post("/proposals/:proposalId/review", controller.submitReview);

export { router as screeningCommitteeRoutes };
