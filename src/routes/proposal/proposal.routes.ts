import express from "express";
import { ProposalVotingHistoryController } from "../../controllers/proposal/votes.controller";

const router = express.Router();
const proposalVotingHistoryController = new ProposalVotingHistoryController();

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
