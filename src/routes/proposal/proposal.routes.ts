import express from "express";
import { ProposalVotingHistoryController } from "../../controllers/proposal/votes.controller";
import { ProposalController } from "../../controllers/proposal/proposals.controller";

const router = express.Router();
const proposalVotingHistoryController = new ProposalVotingHistoryController();
const proposalController = new ProposalController();

router.get("/pending", proposalController.getPendingProposals);

// Define votes as a nested resource under a specific proposal
router.get(
  "/:proposal_id/votes",
  proposalVotingHistoryController.getProposalVotingHistory
);

router.get(
  "/:proposal_id/charts",
  proposalVotingHistoryController.getProposalVotingChartsData
);

export { router as proposalRoutes };
